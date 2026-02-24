import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { rebuildDailyKpiForDate } from '@/lib/analytics/rebuild-daily-kpi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CRON_RATE_LIMIT = 12
const CRON_RATE_WINDOW_MS = 60 * 60 * 1000

function timingSafeMatch(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function toUtcDayStart(date: Date): Date {
  const next = new Date(date)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

export async function GET(request: Request) {
  try {
    const { correlationId, route } = getLogContextFromRequest(request)

    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) {
      return NextResponse.json({ error: 'Cron secret is not configured.' }, { status: 503 })
    }

    const authHeader = request.headers.get('authorization')?.trim() ?? ''
    const bearerPrefix = 'Bearer '
    const providedToken = authHeader.startsWith(bearerPrefix)
      ? authHeader.slice(bearerPrefix.length).trim()
      : ''

    if (!providedToken || !timingSafeMatch(providedToken, cronSecret)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimitError = await enforceRateLimit({
      request,
      bucket: 'INTERNAL_KPI_CRON_REBUILD',
      limit: CRON_RATE_LIMIT,
      windowMs: CRON_RATE_WINDOW_MS,
      message: 'Too many cron rebuild attempts. Please retry later.',
      extraKey: 'daily',
    })
    if (rateLimitError) {
      return rateLimitError
    }

    const todayUtc = toUtcDayStart(new Date())
    const yesterdayUtc = new Date(todayUtc)
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1)

    logServerEvent({
      event: 'internal.kpi.rebuild.daily.requested',
      correlationId,
      route,
      details: {
        date: yesterdayUtc.toISOString().slice(0, 10),
      },
    })

    const rebuilt = await rebuildDailyKpiForDate(yesterdayUtc)

    logServerEvent({
      event: 'internal.kpi.rebuild.daily.completed',
      correlationId,
      route,
      details: {
        date: rebuilt.date.toISOString().slice(0, 10),
        signups: rebuilt.signups,
        contracts: rebuilt.contracts,
        payments: rebuilt.payments,
        withdrawalCount: rebuilt.withdrawalCount,
        withdrawalVolume: rebuilt.withdrawalVolume,
        grossVolume: rebuilt.grossVolume,
        netCashFlow: rebuilt.netCashFlow,
      },
    })

    return NextResponse.json({
      date: rebuilt.date.toISOString().slice(0, 10),
      signups: rebuilt.signups,
      contracts: rebuilt.contracts,
      payments: rebuilt.payments,
      withdrawalCount: rebuilt.withdrawalCount,
      withdrawalVolume: rebuilt.withdrawalVolume,
      grossVolume: rebuilt.grossVolume,
      netCashFlow: rebuilt.netCashFlow,
    })
  } catch (error) {
    const { correlationId, route } = getLogContextFromRequest(request)
    await captureServerError(error, {
      scope: 'internal_kpi_daily_rebuild',
      targetType: 'ANALYTICS',
      correlationId,
      route,
      event: 'internal.kpi.rebuild.daily.failed',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
