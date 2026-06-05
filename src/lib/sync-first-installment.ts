import { prisma } from '@/lib/prisma'
import { computeFirstInstallmentAmounts } from '@/lib/rental-first-payment'

function amountsMatch(expected: number, actual: number) {
  return Math.abs(expected - actual) < 0.01
}

/**
 * Aligne l'echeance #1 (OPEN/OVERDUE) et les paiements PENDING lies
 * sur caution + 3 mois d'avance.
 */
export async function syncFirstRentalInstallment(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractType: true,
      rentAmount: true,
      depositAmount: true,
    },
  })

  if (!contract || contract.contractType !== 'RENTAL') return null

  const first = await prisma.contractInstallment.findFirst({
    where: { contractId: contract.id, sequence: 1 },
    select: {
      id: true,
      status: true,
      paidAt: true,
      baseAmount: true,
      totalDue: true,
    },
  })

  if (!first || first.status === 'PAID' || first.paidAt) return first

  const expected = computeFirstInstallmentAmounts(contract.rentAmount, contract.depositAmount)
  if (amountsMatch(Number(first.totalDue), expected.totalDue)) return first

  const pendingPayments = await prisma.payment.findMany({
    where: {
      installmentId: first.id,
      status: 'PENDING',
    },
    select: { id: true, amount: true },
  })

  await prisma.$transaction([
    prisma.contractInstallment.update({
      where: { id: first.id },
      data: {
        baseAmount: expected.baseAmount,
        penaltyAmount: 0,
        totalDue: expected.totalDue,
      },
    }),
    ...pendingPayments.map((payment) =>
      prisma.payment.update({
        where: { id: payment.id },
        data: { amount: expected.totalDue },
      })
    ),
  ])

  return {
    ...first,
    baseAmount: expected.baseAmount,
    totalDue: expected.totalDue,
    synced: true,
    pendingPaymentsUpdated: pendingPayments.length,
  }
}
