import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logServerEvent } from '@/lib/logger'

export type TrackEventParams = {
  type: 'SIGNUP' | 'CONTRACT_CREATED' | 'PAYMENT_COMPLETED' | 'WITHDRAW_REQUESTED'
  userId?: string
  entityId?: string
  metadata?: Record<string, unknown>
  correlationId?: string
}

/**
 * Non-blocking analytics tracking helper.
 * Any failure is swallowed and only forwarded to monitoring/logging.
 */
export async function trackEvent({
  type,
  userId,
  entityId,
  metadata,
  correlationId,
}: TrackEventParams) {
  try {
    await prisma.businessEvent.create({
      data: {
        type,
        userId,
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (error) {
    logServerEvent({
      level: 'error',
      event: 'analytics.track.failed',
      message: 'Failed to persist BusinessEvent',
      correlationId,
      userId: userId ?? null,
      details: {
        type,
        entityId: entityId ?? null,
      },
    })

    try {
      Sentry.withScope((scope) => {
        scope.setTag('layer', 'analytics')
        scope.setTag('type', type)
        if (correlationId) {
          scope.setTag('correlationId', correlationId)
        }
        if (userId) {
          scope.setUser({ id: userId })
        }
        if (entityId) {
          scope.setExtra('entityId', entityId)
        }
        if (metadata) {
          scope.setExtra('metadata', metadata)
        }
        Sentry.captureException(error)
      })
    } catch {
      // Monitoring should never impact request flow.
    }
  }
}

