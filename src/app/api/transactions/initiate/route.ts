import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceCsrf } from '@/lib/csrf'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { captureServerError } from '@/lib/monitoring'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const payloadSchema = z
  .object({
    propertyId: z.string().trim().cuid(),
  })
  .strict()

const ACTIVE_TRANSACTION_STATUSES = [
  'INITIATED',
  'FUNDS_ESCROWED',
  'LEGAL_VERIFIED',
  'DISPUTED',
]

function resolveEscrowAmount(price: number) {
  const fallback = 50000
  const configured = Number(process.env.ESCROW_RESERVATION_FEE)
  const fee = Number.isFinite(configured) && configured > 0 ? configured : fallback
  return Math.min(price, fee)
}

export async function POST(request: Request) {
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

    if (user.role !== 'TENANT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = payloadSchema.parse(await request.json())

    const property = await prisma.property.findUnique({
      where: { id: payload.propertyId },
      select: {
        id: true,
        title: true,
        offerType: true,
        status: true,
        isPublished: true,
        managerId: true,
        price: true,
      },
    })

    if (!property || !property.isPublished) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (property.offerType !== 'SALE') {
      return NextResponse.json({ error: 'Only sale listings can be purchased.' }, { status: 409 })
    }

    if (property.managerId && property.managerId === user.id) {
      return NextResponse.json({ error: 'Owner cannot purchase its own listing.' }, { status: 409 })
    }

    if (property.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'This listing is not available for purchase.' },
        { status: 409 }
      )
    }

    const escrowAmount = resolveEscrowAmount(property.price)
    const totalAmount = property.price

    const transaction = await prisma.$transaction(async (tx) => {
      const active = await tx.purchaseTransaction.findFirst({
        where: {
          propertyId: property.id,
          status: { in: ACTIVE_TRANSACTION_STATUSES },
        },
        select: { id: true, status: true },
      })

      if (active) {
        return null
      }

      const lock = await tx.property.updateMany({
        where: { id: property.id, status: 'AVAILABLE' },
        data: { status: 'PENDING_TRANSACTION' },
      })

      if (lock.count === 0) {
        return null
      }

      return tx.purchaseTransaction.create({
        data: {
          propertyId: property.id,
          buyerId: user.id,
          sellerId: property.managerId ?? null,
          status: 'INITIATED',
          escrowAmount,
          totalAmount,
          legalVerification: { create: {} },
        },
        select: {
          id: true,
          status: true,
          escrowAmount: true,
          totalAmount: true,
          buyerId: true,
          sellerId: true,
        },
      })
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'A transaction is already in progress for this listing.' },
        { status: 409 }
      )
    }

    if (property.managerId) {
      await prisma.notification.create({
        data: {
          userId: property.managerId,
          type: 'PURCHASE_INITIATED',
          title: 'Nouvelle transaction de vente',
          message: `Une demande d achat a ete initiee pour ${property.title}.`,
        },
      })
    }

    await createSystemLog({
      actor: user,
      action: 'PURCHASE_TRANSACTION_INITIATED',
      targetType: 'PURCHASE_TRANSACTION',
      targetId: transaction.id,
      correlationId,
      route,
      details: `propertyId=${property.id};escrowAmount=${escrowAmount};totalAmount=${totalAmount}`,
    })

    logServerEvent({
      event: 'purchase.transaction.initiated',
      correlationId,
      route,
      userId: user.id,
      details: {
        propertyId: property.id,
        transactionId: transaction.id,
        escrowAmount,
      },
    })

    return NextResponse.json({
      transaction,
      message: 'Transaction initiee. Versement du sequestre en attente.',
    })
  } catch (error) {
    await captureServerError(error, {
      scope: 'purchase_transaction_initiate',
      correlationId,
      route,
      event: 'purchase.transaction.initiate.failed',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
