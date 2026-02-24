import { randomUUID } from 'crypto'
import { EventType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DailyKpiSnapshot = {
  date: Date
  signups: number
  contracts: number
  payments: number
  withdrawalCount: number
  withdrawalVolume: number
  grossVolume: number
  netCashFlow: number
}

function toUtcDayStart(input: Date): Date {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date provided to rebuildDailyKpiForDate')
  }

  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcDays(input: Date, days: number): Date {
  const next = new Date(input)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function readAmount(metadata: Prisma.JsonValue | null): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 0
  }

  const raw = (metadata as Record<string, unknown>).amount
  const amount = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(amount) ? amount : 0
}

function computeDailySnapshot(
  date: Date,
  events: Array<{ type: EventType; metadata: Prisma.JsonValue | null }>
): DailyKpiSnapshot {
  let signups = 0
  let contracts = 0
  let payments = 0
  let withdrawalCount = 0
  let grossVolume = 0
  let withdrawalVolume = 0

  for (const event of events) {
    if (event.type === EventType.SIGNUP) {
      signups += 1
      continue
    }

    if (event.type === EventType.CONTRACT_CREATED) {
      contracts += 1
      continue
    }

    if (event.type === EventType.PAYMENT_COMPLETED) {
      payments += 1
      grossVolume += readAmount(event.metadata)
      continue
    }

    if (event.type === EventType.WITHDRAW_REQUESTED) {
      withdrawalCount += 1
      withdrawalVolume += readAmount(event.metadata)
    }
  }

  grossVolume = roundMoney(grossVolume)
  withdrawalVolume = roundMoney(withdrawalVolume)
  const netCashFlow = roundMoney(grossVolume - withdrawalVolume)

  return {
    date,
    signups,
    contracts,
    payments,
    withdrawalCount,
    withdrawalVolume,
    grossVolume,
    netCashFlow,
  }
}

export async function rebuildDailyKpiForDate(input: Date = new Date()) {
  const date = toUtcDayStart(input)
  const nextDate = addUtcDays(date, 1)

  const events = await prisma.businessEvent.findMany({
    where: {
      createdAt: {
        gte: date,
        lt: nextDate,
      },
    },
    select: {
      type: true,
      metadata: true,
    },
  })

  const snapshot = computeDailySnapshot(date, events)

  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "DailyKPI" (
      "id",
      "date",
      "signups",
      "contracts",
      "payments",
      "withdrawalCount",
      "withdrawalVolume",
      "grossVolume",
      "netCashFlow",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${snapshot.date},
      ${snapshot.signups},
      ${snapshot.contracts},
      ${snapshot.payments},
      ${snapshot.withdrawalCount},
      ${snapshot.withdrawalVolume},
      ${snapshot.grossVolume},
      ${snapshot.netCashFlow},
      ${now},
      ${now}
    )
    ON CONFLICT ("date") DO UPDATE SET
      "signups" = EXCLUDED."signups",
      "contracts" = EXCLUDED."contracts",
      "payments" = EXCLUDED."payments",
      "withdrawalCount" = EXCLUDED."withdrawalCount",
      "withdrawalVolume" = EXCLUDED."withdrawalVolume",
      "grossVolume" = EXCLUDED."grossVolume",
      "netCashFlow" = EXCLUDED."netCashFlow",
      "updatedAt" = EXCLUDED."updatedAt"
  `

  return snapshot
}

export async function rebuildDailyKpiRange(start: Date, end: Date) {
  const startDay = toUtcDayStart(start)
  const endDay = toUtcDayStart(end)

  if (endDay < startDay) {
    throw new Error('Invalid range: end date must be greater than or equal to start date')
  }

  const results: DailyKpiSnapshot[] = []
  for (let cursor = new Date(startDay); cursor <= endDay; cursor = addUtcDays(cursor, 1)) {
    const snapshot = await rebuildDailyKpiForDate(cursor)
    results.push(snapshot)
  }

  return results
}
