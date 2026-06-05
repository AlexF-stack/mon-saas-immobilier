import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { createAppNotification } from '@/lib/app-notifications'
import {
  buildSnapshot as buildPartySnapshot,
  validateOwnerPartyProfile,
  validateTenantPartyProfile,
} from '@/lib/party-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const contractTypeSchema = z.enum(['RENTAL', 'SALE'])
const sourceSchema = z.enum(['UPLOAD', 'DRAFT'])

const saveDocumentSchema = z.object({
  action: z.literal('SAVE_DOCUMENT'),
  documentSource: sourceSchema,
  contractType: contractTypeSchema.optional(),
  rentalTermsSnapshot: z.string().trim().min(20).max(5000).optional(),
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
            manager: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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
          rentalTermsSnapshot: payload.rentalTermsSnapshot ?? contract.rentalTermsSnapshot,
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

      await createAppNotification({
        userId: contract.tenantId,
        type: 'CONTRACT_DOCUMENT_SAVED',
        title: 'Document de contrat en preparation',
        message: `Le contrat pour ${contract.property.title} est en cours de preparation.`,
      })

      return NextResponse.json({ contract: updated, message: 'Document de contrat enregistre.' })
    }

    if (payload.action === 'SUBMIT') {
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (contract.contractType === 'RENTAL') {
        const ownerMissing = validateOwnerPartyProfile(buildPartySnapshot(contract), {
          name: contract.property.manager?.name,
          phone: contract.property.manager?.phone,
          email: contract.property.manager?.email,
        })
        if (ownerMissing.length > 0) {
          return NextResponse.json(
            {
              error: `Completez le profil bailleur (Article 1 et 2 du bail) avant soumission : ${ownerMissing.join(', ')}`,
              missingFields: ownerMissing,
            },
            { status: 409 }
          )
        }
      }

      const termsSnapshot = contract.rentalTermsSnapshot?.trim() ?? ''
      const hasDocument = Boolean(
        contract.fileUrl ||
          contract.contractText?.trim() ||
          (termsSnapshot.length >= 20)
      )
      if (!hasDocument) {
        return NextResponse.json(
          {
            error:
              'Enregistrez d abord le document du contrat (texte ou URL PDF), puis soumettez au locataire.',
          },
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
          ...(!contract.contractText?.trim() && !contract.fileUrl && termsSnapshot.length >= 20
            ? {
                contractText: termsSnapshot,
                documentSource: contract.documentSource ?? 'DRAFT',
              }
            : {}),
        },
      })

      await createAppNotification({
        userId: contract.tenantId,
        type: 'CONTRACT_SUBMITTED',
        title: 'Nouveau contrat a signer',
        message: `Le contrat ${contract.property.title} vous a ete soumis. Veuillez le verifier et le signer.`,
      })

      await createSystemLog({
        actor: user,
        action: 'CONTRACT_SUBMITTED',
        targetType: 'CONTRACT',
        targetId: contract.id,
        details: `tenantId=${contract.tenantId};workflowState=${submitted.workflowState}`,
      })

      return NextResponse.json({ contract: submitted, message: 'Contrat soumis au locataire. Vous pouvez maintenant signer.' })
    }

    if (!contract.submittedAt) {
      return NextResponse.json(
        {
          error:
            'Soumettez le contrat au locataire avant de signer (bouton « Soumettre au locataire/acheteur »).',
        },
        { status: 409 }
      )
    }

    if (isTenantCounterparty && contract.contractType === 'RENTAL') {
      const tenantMissing = validateTenantPartyProfile(buildPartySnapshot(contract), {
        name: contract.tenant.name,
        phone: contract.tenant.phone,
        email: contract.tenant.email,
      })
      if (tenantMissing.length > 0) {
        return NextResponse.json(
          {
            error: `Completez votre profil locataire (Article 1 du bail) avant signature : ${tenantMissing.join(', ')}`,
            missingFields: tenantMissing,
          },
          { status: 409 }
        )
      }
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

    const counterpartyId = canManage ? contract.tenantId : contract.property.managerId
    if (counterpartyId) {
      await createAppNotification({
        userId: counterpartyId,
        type: 'CONTRACT_SIGNATURE',
        title: 'Signature de contrat',
        message:
          readyState === 'SIGNED_BOTH'
            ? `Le contrat ${contract.property.title} est signe par les deux parties.`
            : `Une signature a ete enregistree sur le contrat ${contract.property.title}.`,
      })
    }

    if (readyState === 'SIGNED_BOTH' && contract.property.managerId) {
      await createAppNotification({
        userId: contract.tenantId,
        type: 'CONTRACT_READY_FOR_PAYMENT',
        title: 'Contrat pret pour paiement',
        message: `Le contrat ${contract.property.title} est signe. Vous pouvez proceder au paiement.`,
      })
    }

    return NextResponse.json({
      contract: finalized,
      message:
        readyState === 'SIGNED_BOTH'
          ? 'Contrat signe par les deux parties. Paiement possible.'
          : 'Signature enregistree.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Contract workflow error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
