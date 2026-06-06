import type { Prisma } from '@prisma/client'
import { createFinancialAuditLog } from '@/lib/financial-audit'
import { createAppNotification } from '@/lib/app-notifications'

export function buildReceiptNumber(paymentId: string, date: Date) {
  const suffix = paymentId.slice(-6).toUpperCase()
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `RCP-${stamp}-${suffix}`
}

type CompletePaymentActor = {
  id: string
  email: string
  role: string
}

export type ManualCompleteFresh = {
  ok: true
  alreadyCompleted: false
  payment: { id: string; receiptNumber: string | null; amount: number; status: string }
  contractTitle: string
  tenantId: string
  managerId: string | null
}

export type ManualCompleteReplay = {
  ok: true
  alreadyCompleted: true
  paymentId: string
  receiptNumber: string | null
}

export type ManualCompleteFailure = {
  ok: false
  error: string
  status: number
}

export async function completePaymentInTransaction(
  tx: Prisma.TransactionClient,
  paymentId: string,
  actor: CompletePaymentActor,
  options?: { correlationId?: string; source?: string }
) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: {
      contract: {
        select: {
          id: true,
          tenantId: true,
          activatedAt: true,
          property: {
            select: { id: true, title: true, managerId: true },
          },
          tenant: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  })

  if (!payment) {
    return { ok: false, error: 'Payment not found', status: 404 } satisfies ManualCompleteFailure
  }

  if (payment.status === 'COMPLETED') {
    return {
      ok: true,
      alreadyCompleted: true,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
    } satisfies ManualCompleteReplay
  }

  if (payment.status === 'FAILED') {
    return {
      ok: false,
      error: 'Ce paiement a echoue et ne peut pas etre confirme.',
      status: 409,
    } satisfies ManualCompleteFailure
  }

  const now = new Date()
  const receiptNumber = payment.receiptNumber ?? buildReceiptNumber(payment.id, now)

  const updatedPayment = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      updatedAt: now,
      receiptNumber,
      receiptIssuedAt: payment.receiptIssuedAt ?? now,
    },
    select: {
      id: true,
      status: true,
      receiptNumber: true,
      amount: true,
    },
  })

  await tx.contract.update({
    where: { id: payment.contractId },
    data: {
      workflowState: 'ACTIVE',
      activatedAt: payment.contract.activatedAt ?? now,
    },
  })

  if (payment.installmentId) {
    await tx.contractInstallment.updateMany({
      where: {
        id: payment.installmentId,
        paidAt: null,
        status: { in: ['OPEN', 'OVERDUE'] },
      },
      data: {
        status: 'PAID',
        paidAt: now,
      },
    })

    await tx.payment.updateMany({
      where: {
        installmentId: payment.installmentId,
        id: { not: payment.id },
        status: 'PENDING',
      },
      data: { status: 'FAILED', updatedAt: now },
    })
  }

  await createFinancialAuditLog(tx, {
    type: 'PAYMENT',
    entityId: payment.id,
    fromStatus: payment.status,
    toStatus: 'COMPLETED',
    actorId: actor.id,
    correlationId: options?.correlationId,
    metadata: {
      source: options?.source ?? 'manual_confirm',
      contractId: payment.contractId,
      installmentId: payment.installmentId,
    },
  })

  await tx.systemLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PAYMENT_CONFIRMED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      details: `source=${options?.source ?? 'manual_confirm'};amount=${payment.amount}`,
    },
  })

  return {
    ok: true,
    alreadyCompleted: false,
    payment: updatedPayment,
    contractTitle: payment.contract.property.title,
    tenantId: payment.contract.tenantId,
    managerId: payment.contract.property.managerId,
  } satisfies ManualCompleteFresh
}

export async function notifyPaymentCompleted(result: ManualCompleteFresh) {
  await createAppNotification({
    userId: result.tenantId,
    type: 'PAYMENT_COMPLETED',
    title: 'Paiement confirme',
    message: `Votre paiement de ${result.payment.amount.toLocaleString('fr-FR')} FCFA pour ${result.contractTitle} est confirme. La quittance est disponible.`,
    paymentId: result.payment.id,
  })

  if (result.managerId) {
    await createAppNotification({
      userId: result.managerId,
      type: 'PAYMENT_COMPLETED',
      title: 'Paiement recu',
      message: `Paiement de ${result.payment.amount.toLocaleString('fr-FR')} FCFA confirme pour ${result.contractTitle}.`,
      paymentId: result.payment.id,
    })
  }
}
