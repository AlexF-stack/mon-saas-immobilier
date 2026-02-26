import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const contractTypeSchema = z.enum(['RENTAL', 'SALE'])
const sourceSchema = z.enum(['UPLOAD', 'DRAFT'])

const saveDocumentSchema = z.object({
  action: z.literal('SAVE_DOCUMENT'),
  documentSource: sourceSchema,
  contractType: contractTypeSchema.optional(),
  contractFileUrl: z.string().trim().url().max(1200).optional(),
  contractText: z.string().trim().max(20000).optional(),
  receiptFileUrl: z.string().trim().url().max(1200).optional(),
  receiptText: z.string().trim().max(20000).optional(),
})

const submitSchema = z.object({
  action: z.literal('SUBMIT'),
})

const signSchema = z.object({
  action: z.literal('SIGN'),
})

const workflowPayloadSchema = z.discriminatedUnion('action', [
  saveDocumentSchema,
  submitSchema,
  signSchema,
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const payload = workflowPayloadSchema.parse(await request.json())

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            managerId: true,
            offerType: true,
            title: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const canManage = canManageProperty(user, contract.property.managerId)
    const isTenantCounterparty = user.role === 'TENANT' && contract.tenantId === user.id

    if (payload.action === 'SAVE_DOCUMENT') {
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (contract.workflowState === 'ACTIVE' || contract.workflowState === 'PAYMENT_INITIATED') {
        return NextResponse.json(
          { error: 'Cannot modify contract document after payment workflow started' },
          { status: 409 }
        )
      }

      const expectedType = contract.property.offerType === 'SALE' ? 'SALE' : 'RENTAL'
      const nextType = payload.contractType ?? expectedType
      if (nextType !== expectedType) {
        return NextResponse.json(
          { error: `Contract type must match property offer (${expectedType})` },
          { status: 409 }
        )
      }

      const usingUpload = payload.documentSource === 'UPLOAD'
      const usingDraft = payload.documentSource === 'DRAFT'
      if (usingUpload && !payload.contractFileUrl) {
        return NextResponse.json({ error: 'contractFileUrl is required for upload mode' }, { status: 400 })
      }
      if (usingDraft && !payload.contractText) {
        return NextResponse.json({ error: 'contractText is required for draft mode' }, { status: 400 })
      }

      const updated = await prisma.contract.update({
        where: { id: contract.id },
        data: {
          contractType: nextType,
          documentSource: payload.documentSource,
          fileUrl: usingUpload ? payload.contractFileUrl ?? null : null,
          contractText: usingDraft ? payload.contractText ?? null : null,
          receiptFileUrl: payload.receiptFileUrl ?? null,
          receiptText: payload.receiptText ?? null,
          workflowState: 'DRAFT',
          submittedAt: null,
          ownerSignedAt: null,
          tenantSignedAt: null,
          paymentInitiatedAt: null,
          activatedAt: null,
        },
      })

      await createSystemLog({
        actor: user,
        action: 'CONTRACT_DOCUMENT_SAVED',
        targetType: 'CONTRACT',
        targetId: contract.id,
        details: `source=${updated.documentSource};workflowState=${updated.workflowState};contractType=${updated.contractType}`,
      })

      return NextResponse.json({ contract: updated, message: 'Contract document saved.' })
    }

    if (payload.action === 'SUBMIT') {
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const hasDocument = Boolean(contract.fileUrl || contract.contractText)
      if (!hasDocument) {
        return NextResponse.json(
          { error: 'Save a contract document first (upload or draft).' },
          { status: 409 }
        )
      }

      if (contract.workflowState === 'ACTIVE' || contract.workflowState === 'PAYMENT_INITIATED') {
        return NextResponse.json({ error: 'Contract already in payment workflow' }, { status: 409 })
      }

      const submitted = await prisma.contract.update({
        where: { id: contract.id },
        data: {
          submittedAt: new Date(),
          workflowState: 'SUBMITTED',
          ownerSignedAt: null,
          tenantSignedAt: null,
        },
      })

      await prisma.notification.create({
        data: {
          userId: contract.tenantId,
          type: 'CONTRACT_SUBMITTED',
          title: 'Nouveau contrat a signer',
          message: `Le contrat ${contract.property.title} vous a ete soumis. Veuillez le verifier et le signer.`,
        },
      })

      await createSystemLog({
        actor: user,
        action: 'CONTRACT_SUBMITTED',
        targetType: 'CONTRACT',
        targetId: contract.id,
        details: `tenantId=${contract.tenantId};workflowState=${submitted.workflowState}`,
      })

      return NextResponse.json({ contract: submitted, message: 'Contract submitted to tenant/buyer.' })
    }

    if (!contract.submittedAt) {
      return NextResponse.json({ error: 'Contract must be submitted before signature' }, { status: 409 })
    }

    if (!canManage && !isTenantCounterparty) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const signData =
      canManage
        ? { ownerSignedAt: contract.ownerSignedAt ?? new Date() }
        : { tenantSignedAt: contract.tenantSignedAt ?? new Date() }

    const signed = await prisma.contract.update({
      where: { id: contract.id },
      data: signData,
      select: {
        id: true,
        workflowState: true,
        ownerSignedAt: true,
        tenantSignedAt: true,
      },
    })

    const ownerSignedAt = canManage ? (signData as { ownerSignedAt?: Date }).ownerSignedAt ?? signed.ownerSignedAt : signed.ownerSignedAt
    const tenantSignedAt = !canManage ? (signData as { tenantSignedAt?: Date }).tenantSignedAt ?? signed.tenantSignedAt : signed.tenantSignedAt
    const readyState = ownerSignedAt && tenantSignedAt ? 'SIGNED_BOTH' : 'SUBMITTED'

    const finalized = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        workflowState: readyState,
      },
    })

    await createSystemLog({
      actor: user,
      action: canManage ? 'CONTRACT_SIGNED_BY_OWNER' : 'CONTRACT_SIGNED_BY_TENANT',
      targetType: 'CONTRACT',
      targetId: contract.id,
      details: `workflowState=${readyState}`,
    })

    return NextResponse.json({
      contract: finalized,
      message: readyState === 'SIGNED_BOTH' ? 'Contract signed by both parties.' : 'Signature recorded.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Contract workflow error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
