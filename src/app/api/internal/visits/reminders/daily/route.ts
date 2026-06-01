import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { sendUpcomingVisitReminders } from '@/lib/visit-reminders'

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
      bucket: 'VISIT_REMINDER_CRON',
      limit: CRON_RATE_LIMIT,
      windowMs: CRON_RATE_WINDOW_MS,
      extraKey: 'daily',
    })
    if (rateLimitError) return rateLimitError

    const result = await sendUpcomingVisitReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    await captureServerError(error, { scope: 'visit_reminders_daily' })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
