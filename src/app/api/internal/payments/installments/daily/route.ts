import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { runDailyInstallmentMaintenance } from '@/lib/installments'

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
      bucket: 'INSTALLMENT_MAINTENANCE_CRON',
      limit: CRON_RATE_LIMIT,
      windowMs: CRON_RATE_WINDOW_MS,
      message: 'Too many installment maintenance cron calls.',
      extraKey: 'daily',
    })
    if (rateLimitError) {
      return rateLimitError
    }

    logServerEvent({
      event: 'internal.installment.daily.requested',
      correlationId,
      route,
    })

    const summary = await runDailyInstallmentMaintenance({
      runDate: new Date(),
      correlationId,
      route,
    })

    logServerEvent({
      event: 'internal.installment.daily.completed',
      correlationId,
      route,
      details: summary,
    })

    return NextResponse.json(summary)
  } catch (error) {
    const { correlationId, route } = getLogContextFromRequest(request)
    await captureServerError(error, {
      scope: 'internal_installment_daily',
      targetType: 'INSTALLMENT',
      correlationId,
      route,
      event: 'internal.installment.daily.failed',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
