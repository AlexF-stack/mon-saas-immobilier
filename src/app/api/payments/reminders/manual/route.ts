import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'
import { captureServerError } from '@/lib/monitoring'
import {
  REMINDER_DAY_OFFSETS,
  sendManualPaymentReminder,
  type ReminderDeliveryChannel,
} from '@/lib/payment-reminders'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANUAL_REMINDER_LIMIT = 20
const MANUAL_REMINDER_WINDOW_MS = 60 * 60 * 1000

const manualReminderSchema = z.object({
  contractId: z.string().trim().min(1),
  daysBefore: z
    .coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof REMINDER_DAY_OFFSETS)[number] =>
        REMINDER_DAY_OFFSETS.includes(value as (typeof REMINDER_DAY_OFFSETS)[number]),
      'Invalid reminder offset.'
    ),
  channels: z
    .array(z.enum(['EMAIL', 'SMS', 'WHATSAPP']))
    .min(1)
    .optional(),
})

function sanitizeChannels(channels: ReminderDeliveryChannel[] | undefined): ReminderDeliveryChannel[] {
  if (!channels || channels.length === 0) return ['EMAIL', 'SMS', 'WHATSAPP']
  return [...new Set(channels)]
}

export async function POST(request: Request) {
  const logContext = getLogContextFromRequest(request)

  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimitError = await enforceRateLimit({
      request,
      bucket: 'PAYMENT_REMINDER_MANUAL',
      limit: MANUAL_REMINDER_LIMIT,
      windowMs: MANUAL_REMINDER_WINDOW_MS,
      actor: user,
      extraKey: user.id,
      message: 'Too many reminder attempts. Please retry later.',
    })
    if (rateLimitError) {
      return rateLimitError
    }

    const payload = manualReminderSchema.parse(await request.json())
    const channels = sanitizeChannels(payload.channels)

    const contractAccess = await prisma.contract.findUnique({
      where: { id: payload.contractId },
      select: {
        id: true,
        property: {
          select: {
            managerId: true,
          },
        },
      },
    })

    if (!contractAccess) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (user.role === 'MANAGER' && contractAccess.property.managerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    logServerEvent({
      event: 'payment.reminder.manual.requested',
      correlationId: logContext.correlationId,
      route: logContext.route,
      userId: user.id,
      details: {
        contractId: payload.contractId,
        daysBefore: payload.daysBefore,
        channels,
      },
    })

    const result = await sendManualPaymentReminder({
      contractId: payload.contractId,
      daysBefore: payload.daysBefore,
      channels,
      correlationId: logContext.correlationId,
      route: logContext.route,
    })

    logServerEvent({
      event: 'payment.reminder.manual.completed',
      correlationId: logContext.correlationId,
      route: logContext.route,
      userId: user.id,
      details: result,
    })

    return NextResponse.json({
      message: result.inAppNotificationSent
        ? 'Reminder sent successfully.'
        : 'Duplicate reminder ignored (already sent recently).',
      ...result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }

    if (error instanceof Error && error.message === 'CONTRACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (error instanceof Error && (error.message === 'CONTRACT_NOT_ACTIVE' || error.message === 'CONTRACT_EXPIRED')) {
      return NextResponse.json({ error: 'Contract is not eligible for reminders' }, { status: 409 })
    }

    await captureServerError(error, {
      scope: 'payment_reminder_manual',
      targetType: 'PAYMENT_REMINDER',
      correlationId: logContext.correlationId,
      route: logContext.route,
      event: 'payment.reminder.manual.failed',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
