import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'
import { captureServerError } from '@/lib/monitoring'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 90
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD format')

type DailyKpiRow = {
  date: Date
  signups: number
  contracts: number
  payments: number
  withdrawalCount: number
  withdrawalVolume: number
  grossVolume: number
  netCashFlow: number
}

function parseUtcDay(value: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  try {
    const { correlationId, route } = getLogContextFromRequest(request)

    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyAuth(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: 'Missing required query params: from and to (YYYY-MM-DD).' },
        { status: 400 }
      )
    }

    const fromParsed = isoDateSchema.safeParse(fromParam)
    const toParsed = isoDateSchema.safeParse(toParam)
    if (!fromParsed.success || !toParsed.success) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD for from and to.' },
        { status: 400 }
      )
    }

    const from = parseUtcDay(fromParsed.data)
    const to = parseUtcDay(toParsed.data)
    if (!from || !to) {
      return NextResponse.json({ error: 'Invalid calendar date value.' }, { status: 400 })
    }

    if (to < from) {
      return NextResponse.json({ error: 'Invalid date range: from must be <= to.' }, { status: 400 })
    }

    const rangeDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range too large. Maximum is ${MAX_RANGE_DAYS} days.` },
        { status: 400 }
      )
    }

    logServerEvent({
      event: 'internal.kpi.fetch.requested',
      correlationId,
      route,
      userId: user.id,
      details: {
        from: fromParsed.data,
        to: toParsed.data,
        rangeDays,
      },
    })

    const toExclusive = addUtcDays(to, 1)
    const rows = await prisma.$queryRaw<DailyKpiRow[]>`
      SELECT
        "date",
        "signups",
        "contracts",
        "payments",
        "withdrawalCount",
        "withdrawalVolume",
        "grossVolume",
        "netCashFlow"
      FROM "DailyKPI"
      WHERE "date" >= ${from} AND "date" < ${toExclusive}
      ORDER BY "date" ASC
    `

    const byDate = new Map(
      rows.map((row) => [formatUtcDay(new Date(row.date)), row] as const)
    )

    const data = []
    for (let cursor = new Date(from); cursor <= to; cursor = addUtcDays(cursor, 1)) {
      const dateKey = formatUtcDay(cursor)
      const row = byDate.get(dateKey)

      data.push({
        date: dateKey,
        signups: row ? toNumber(row.signups) : 0,
        contracts: row ? toNumber(row.contracts) : 0,
        payments: row ? toNumber(row.payments) : 0,
        withdrawalCount: row ? toNumber(row.withdrawalCount) : 0,
        withdrawalVolume: row ? toNumber(row.withdrawalVolume) : 0,
        grossVolume: row ? toNumber(row.grossVolume) : 0,
        netCashFlow: row ? toNumber(row.netCashFlow) : 0,
      })
    }

    logServerEvent({
      event: 'internal.kpi.fetch.completed',
      correlationId,
      route,
      userId: user.id,
      details: {
        from: fromParsed.data,
        to: toParsed.data,
        points: data.length,
      },
    })

    return NextResponse.json({
      from: fromParsed.data,
      to: toParsed.data,
      rangeDays,
      data,
    })
  } catch (error) {
    const { correlationId, route } = getLogContextFromRequest(request)
    await captureServerError(error, {
      scope: 'internal_kpi_fetch',
      targetType: 'ANALYTICS',
      correlationId,
      route,
      event: 'internal.kpi.fetch.failed',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
