import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canAccessContractScope, canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import { completePaymentInTransaction, notifyPaymentCompleted } from '@/lib/complete-payment'
import { getLogContextFromRequest } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const { correlationId } = getLogContextFromRequest(request)

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            tenantId: true,
            property: { select: { managerId: true } },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (!canAccessContractScope(user, payment.contract)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canConfirm =
      user.role === 'ADMIN' ||
      (user.role === 'MANAGER' && canManageProperty(user, payment.contract.property.managerId))

    if (!canConfirm) {
      return NextResponse.json(
        { error: 'Seul le bailleur peut confirmer la reception d un paiement direct.' },
        { status: 403 }
      )
    }

    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Seuls les paiements en attente peuvent etre confirmes.' },
        { status: 409 }
      )
    }

    if (!payment.method.startsWith('DIRECT_')) {
      return NextResponse.json(
        {
          error:
            'La confirmation manuelle concerne les paiements directs (Mobile Money vers le bailleur). Les autres sont valides via le fournisseur.',
        },
        { status: 409 }
      )
    }

    const result = await prisma.$transaction((tx) =>
      completePaymentInTransaction(tx, payment.id, user, {
        correlationId,
        source: 'manager_confirm',
      })
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (result.ok && result.alreadyCompleted) {
      return NextResponse.json({
        message: 'Paiement deja confirme.',
        paymentId: result.paymentId,
        receiptNumber: result.receiptNumber,
        status: 'COMPLETED',
      })
    }

    if (result.ok) {
      await notifyPaymentCompleted(result)
      return NextResponse.json({
        message: 'Paiement confirme. Quittance disponible pour le locataire.',
        paymentId: result.payment.id,
        receiptNumber: result.payment.receiptNumber,
        status: 'COMPLETED',
      })
    }
  } catch (error) {
    console.error('Payment confirm error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
