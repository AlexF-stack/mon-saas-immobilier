import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceCsrf } from '@/lib/csrf'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { createSystemLog } from '@/lib/audit'
import { captureServerError } from '@/lib/monitoring'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const workflowSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ESCROW_PAID') }),
  z.object({
    action: z.literal('SELLER_UPLOAD'),
    documentUrl: z.string().trim().url().max(1200),
  }),
  z.object({ action: z.literal('BUYER_CONFIRM') }),
  z.object({ action: z.literal('ADMIN_VERIFY') }),
  z.object({ action: z.literal('COMPLETE') }),
  z.object({
    action: z.literal('DISPUTE'),
    reason: z.string().trim().min(10).max(500),
  }),
])

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { correlationId, route } = getLogContextFromRequest(request)

  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyAuth(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const payload = workflowSchema.parse(await request.json())

    const transaction = await prisma.purchaseTransaction.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            managerId: true,
          },
        },
        legalVerification: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (TERMINAL_STATUSES.has(transaction.status)) {
      return NextResponse.json({ error: 'Transaction already closed.' }, { status: 409 })
    }

    const isBuyer = transaction.buyerId === user.id
    const isSeller = canManageProperty(user, transaction.property.managerId)

    if (payload.action === 'ESCROW_PAID') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transaction.status !== 'INITIATED') {
        return NextResponse.json({ error: 'Invalid transaction state.' }, { status: 409 })
      }

      const updated = await prisma.purchaseTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FUNDS_ESCROWED' },
        select: { id: true, status: true },
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_ESCROW_CONFIRMED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
        details: `status=${updated.status}`,
      })

      return NextResponse.json({ transaction: updated, message: 'Escrow confirme.' })
    }

    if (payload.action === 'SELLER_UPLOAD') {
      if (!isSeller) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transaction.status !== 'FUNDS_ESCROWED') {
        return NextResponse.json({ error: 'Escrow requis avant depot.' }, { status: 409 })
      }

      const updated = await prisma.legalVerification.upsert({
        where: { transactionId: transaction.id },
        update: {
          documentUrl: payload.documentUrl,
          sellerUploadedAt: transaction.legalVerification?.sellerUploadedAt ?? new Date(),
        },
        create: {
          transactionId: transaction.id,
          documentUrl: payload.documentUrl,
          sellerUploadedAt: new Date(),
        },
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_DOCUMENT_UPLOADED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
        details: `documentUrl=${payload.documentUrl}`,
      })

      return NextResponse.json({
        legalVerification: updated,
        message: 'Document vendeur enregistre.',
      })
    }

    if (payload.action === 'BUYER_CONFIRM') {
      if (!isBuyer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!transaction.legalVerification?.documentUrl) {
        return NextResponse.json(
          { error: 'Document vendeur requis avant confirmation.' },
          { status: 409 }
        )
      }

      const updated = await prisma.legalVerification.update({
        where: { transactionId: transaction.id },
        data: { buyerConfirmedAt: transaction.legalVerification?.buyerConfirmedAt ?? new Date() },
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_BUYER_CONFIRMED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
      })

      return NextResponse.json({
        legalVerification: updated,
        message: 'Confirmation acheteur enregistree.',
      })
    }

    if (payload.action === 'ADMIN_VERIFY') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transaction.status !== 'FUNDS_ESCROWED') {
        return NextResponse.json({ error: 'Invalid transaction state.' }, { status: 409 })
      }
      if (!transaction.legalVerification?.buyerConfirmedAt || !transaction.legalVerification?.sellerUploadedAt) {
        return NextResponse.json({ error: 'Buyer and seller confirmations required.' }, { status: 409 })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const legal = await tx.legalVerification.update({
          where: { transactionId: transaction.id },
          data: { adminVerifiedAt: transaction.legalVerification?.adminVerifiedAt ?? new Date() },
        })
        const txn = await tx.purchaseTransaction.update({
          where: { id: transaction.id },
          data: { status: 'LEGAL_VERIFIED' },
        })
        return { legal, txn }
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_ADMIN_VERIFIED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
        details: `status=${updated.txn.status}`,
      })

      return NextResponse.json({
        transaction: updated.txn,
        legalVerification: updated.legal,
        message: 'Validation admin effectuee.',
      })
    }

    if (payload.action === 'COMPLETE') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transaction.status !== 'LEGAL_VERIFIED') {
        return NextResponse.json({ error: 'Invalid transaction state.' }, { status: 409 })
      }

      const completed = await prisma.$transaction(async (tx) => {
        const txn = await tx.purchaseTransaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED' },
        })

        await tx.property.update({
          where: { id: transaction.propertyId },
          data: { status: 'SOLD', isPublished: false, publishedAt: null },
        })

        return txn
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_COMPLETED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
      })

      return NextResponse.json({ transaction: completed, message: 'Transaction finalisee.' })
    }

    if (payload.action === 'DISPUTE') {
      if (!isBuyer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (transaction.status === 'INITIATED') {
        return NextResponse.json({ error: 'Escrow requis avant litige.' }, { status: 409 })
      }

      const dispute = await prisma.$transaction(async (tx) => {
        const record = await tx.dispute.create({
          data: {
            transactionId: transaction.id,
            reason: payload.reason,
          },
        })
        await tx.purchaseTransaction.update({
          where: { id: transaction.id },
          data: { status: 'DISPUTED' },
        })
        return record
      })

      await createSystemLog({
        actor: user,
        action: 'PURCHASE_DISPUTE_OPENED',
        targetType: 'PURCHASE_TRANSACTION',
        targetId: transaction.id,
        correlationId,
        route,
      })

      return NextResponse.json({ dispute, message: 'Litige ouvert.' })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error) {
    await captureServerError(error, {
      scope: 'purchase_transaction_workflow',
      correlationId,
      route,
      event: 'purchase.transaction.workflow.failed',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }

    logServerEvent({
      level: 'error',
      event: 'purchase.transaction.workflow.failed',
      correlationId,
      route,
      details: { error: String(error) },
    })

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
