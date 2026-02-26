import { prisma } from '@/lib/prisma'
import { createFinancialAuditLog } from '@/lib/financial-audit'
import { createSystemLog } from '@/lib/audit'

export const INSTALLMENT_GRACE_DAYS = 5
export const INSTALLMENT_PENALTY_RATE = 0.05

type DailyInstallmentRunInput = {
  runDate: Date
  correlationId?: string
  route?: string
}

export type DailyInstallmentRunSummary = {
  runDate: string
  scannedContracts: number
  installmentsCreated: number
  overdueMarked: number
  penaltiesApplied: number
  failures: number
  penaltyRate: number
  graceDays: number
}

function getRunDayKey(value: Date): string {
  return toUtcDayStart(value).toISOString().slice(0, 10)
}

function toUtcDayStart(value: Date): Date {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcMonths(value: Date, months: number): Date {
  const date = new Date(value)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date
}

function getDaysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function resolveDueDateForMonth(anchorStartDate: Date, targetMonthDate: Date): Date {
  const year = targetMonthDate.getUTCFullYear()
  const monthIndex = targetMonthDate.getUTCMonth()
  const anchorDay = anchorStartDate.getUTCDate()
  const monthLastDay = getDaysInUtcMonth(year, monthIndex)
  const day = Math.min(anchorDay, monthLastDay)
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function monthDistance(startDate: Date, targetDate: Date): number {
  const yearDelta = targetDate.getUTCFullYear() - startDate.getUTCFullYear()
  const monthDelta = targetDate.getUTCMonth() - startDate.getUTCMonth()
  return yearDelta * 12 + monthDelta
}

function roundFcfa(value: number): number {
  return Math.round(value)
}

export async function createFirstRentalInstallment(input: {
  contractId: string
  startDate: Date
  endDate: Date
  amount: number
}) {
  const start = toUtcDayStart(input.startDate)
  const end = toUtcDayStart(input.endDate)
  if (start > end) return

  await prisma.contractInstallment.upsert({
    where: {
      contractId_sequence: {
        contractId: input.contractId,
        sequence: 1,
      },
    },
    update: {},
    create: {
      contractId: input.contractId,
      sequence: 1,
      dueDate: start,
      baseAmount: input.amount,
      penaltyAmount: 0,
      totalDue: input.amount,
      status: 'OPEN',
    },
  })
}

async function generateMissingInstallments(input: DailyInstallmentRunInput) {
  const dayStart = toUtcDayStart(input.runDate)
  const contracts = await prisma.contract.findMany({
    where: {
      contractType: 'RENTAL',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      rentAmount: true,
    },
  })

  let createdCount = 0

  for (const contract of contracts) {
    const start = toUtcDayStart(contract.startDate)
    const end = toUtcDayStart(contract.endDate)
    if (dayStart < start) continue

    const lastTarget = dayStart < end ? dayStart : end
    const maxSequence = monthDistance(start, lastTarget) + 1
    if (maxSequence < 1) continue

    const existing = await prisma.contractInstallment.findMany({
      where: { contractId: contract.id },
      select: { sequence: true },
    })
    const existingSet = new Set(existing.map((item) => item.sequence))

    const rows: Array<{
      contractId: string
      sequence: number
      dueDate: Date
      baseAmount: number
      penaltyAmount: number
      totalDue: number
      status: 'OPEN'
    }> = []

    for (let sequence = 1; sequence <= maxSequence; sequence += 1) {
      if (existingSet.has(sequence)) continue

      const dueDate = resolveDueDateForMonth(start, addUtcMonths(start, sequence - 1))
      if (dueDate < start || dueDate > end) continue

      rows.push({
        contractId: contract.id,
        sequence,
        dueDate,
        baseAmount: contract.rentAmount,
        penaltyAmount: 0,
        totalDue: contract.rentAmount,
        status: 'OPEN',
      })
    }

    if (rows.length > 0) {
      const result = await prisma.contractInstallment.createMany({
        data: rows,
        skipDuplicates: true,
      })
      createdCount += result.count
    }
  }

  return {
    scannedContracts: contracts.length,
    createdCount,
  }
}

async function applyLatePenalty(input: DailyInstallmentRunInput) {
  const dayStart = toUtcDayStart(input.runDate)
  const graceCutoff = new Date(dayStart)
  graceCutoff.setUTCDate(graceCutoff.getUTCDate() - INSTALLMENT_GRACE_DAYS)

  const overdueResult = await prisma.contractInstallment.updateMany({
    where: {
      status: 'OPEN',
      paidAt: null,
      dueDate: { lt: dayStart },
    },
    data: {
      status: 'OVERDUE',
    },
  })

  const candidates = await prisma.contractInstallment.findMany({
    where: {
      status: 'OVERDUE',
      paidAt: null,
      penaltyAmount: 0,
      dueDate: { lte: graceCutoff },
    },
    include: {
      contract: {
        select: {
          id: true,
          tenantId: true,
          property: {
            select: {
              managerId: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 1500,
  })

  let penaltiesApplied = 0
  let failures = 0

  for (const installment of candidates) {
    try {
      const baseAmount = Number(installment.baseAmount)
      const penaltyAmount = roundFcfa(baseAmount * INSTALLMENT_PENALTY_RATE)
      const totalDue = baseAmount + penaltyAmount

      const updated = await prisma.contractInstallment.updateMany({
        where: {
          id: installment.id,
          status: 'OVERDUE',
          paidAt: null,
          penaltyAmount: 0,
        },
        data: {
          penaltyAmount,
          totalDue,
        },
      })

      if (updated.count !== 1) continue

      penaltiesApplied += 1

      await createFinancialAuditLog(prisma, {
        type: 'INSTALLMENT',
        entityId: installment.id,
        fromStatus: 'OVERDUE',
        toStatus: 'PENALTY_APPLIED',
        actorId: null,
        correlationId: input.correlationId ?? null,
        metadata: {
          contractId: installment.contractId,
          sequence: installment.sequence,
          baseAmount,
          penaltyAmount,
          totalDue,
        },
      })

      await createSystemLog({
        action: 'INSTALLMENT_PENALTY_APPLIED',
        targetType: 'CONTRACT_INSTALLMENT',
        targetId: installment.id,
        correlationId: input.correlationId,
        route: input.route,
        details: `contractId=${installment.contractId};sequence=${installment.sequence};base=${baseAmount};penalty=${penaltyAmount};totalDue=${totalDue}`,
      })

      const reminderMessage = `Penalite de retard appliquee: +${penaltyAmount.toLocaleString('fr-FR')} FCFA sur l'echeance #${installment.sequence}.`
      await prisma.notification.create({
        data: {
          userId: installment.contract.tenantId,
          type: 'PAYMENT_PENALTY',
          title: 'Penalite de retard',
          message: `${reminderMessage} Total du: ${totalDue.toLocaleString('fr-FR')} FCFA.`,
        },
      })
      if (installment.contract.property.managerId) {
        await prisma.notification.create({
          data: {
            userId: installment.contract.property.managerId,
            type: 'PAYMENT_PENALTY',
            title: 'Penalite appliquee',
            message: `${installment.contract.property.title}: ${reminderMessage}`,
          },
        })
      }
    } catch {
      failures += 1
    }
  }

  return {
    overdueMarked: overdueResult.count,
    penaltiesApplied,
    failures,
  }
}

export async function runDailyInstallmentMaintenance(
  input: DailyInstallmentRunInput
): Promise<DailyInstallmentRunSummary> {
  const generation = await generateMissingInstallments(input)
  const penalties = await applyLatePenalty(input)

  return {
    runDate: toUtcDayStart(input.runDate).toISOString().slice(0, 10),
    scannedContracts: generation.scannedContracts,
    installmentsCreated: generation.createdCount,
    overdueMarked: penalties.overdueMarked,
    penaltiesApplied: penalties.penaltiesApplied,
    failures: penalties.failures,
    penaltyRate: INSTALLMENT_PENALTY_RATE,
    graceDays: INSTALLMENT_GRACE_DAYS,
  }
}

export async function acquireInstallmentDailyRunGuard(input: DailyInstallmentRunInput): Promise<{
  allowed: boolean
  runDay: string
}> {
  const runDay = getRunDayKey(input.runDate)

  const allowed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`installment_daily:${runDay}`}))`

    const completed = await tx.systemLog.findFirst({
      where: {
        action: 'INSTALLMENT_DAILY_CRON_COMPLETED',
        targetType: 'CRON_JOB',
        targetId: runDay,
      },
      select: { id: true },
    })

    if (completed) {
      return false
    }

    await tx.systemLog.create({
      data: {
        action: 'INSTALLMENT_DAILY_CRON_STARTED',
        targetType: 'CRON_JOB',
        targetId: runDay,
        details: `correlationId=${input.correlationId ?? 'none'};route=${input.route ?? 'none'}`,
      },
    })

    return true
  })

  return { allowed, runDay }
}
