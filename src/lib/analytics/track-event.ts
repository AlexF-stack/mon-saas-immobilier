import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'; import { Prisma } from '@prisma/client'
import { logServerEvent } from '@/lib/logger'

export type TrackEventParams = {
  type: 'SIGNUP' | 'CONTRACT_CREATED' | 'PAYMENT_COMPLETED' | 'WITHDRAW_REQUESTED'
  userId?: string
  entityId?: string
  metadata?: Prisma.JsonValue | null
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
    // Fire‑and‑forget DB write to avoid blocking the request.
    void prisma.businessEvent.create({
      data: {
        type,
        userId,
        entityId,
        metadata: (metadata as Prisma.JsonValue) ?? undefined,
      },
    }).catch((error) => {
      // Log async failure (same as outer catch handling)
      logServerEvent({
        level: 'error',
        event: 'analytics.track.failed',
        message: 'Failed to persist BusinessEvent (async)',
        correlationId,
        userId: userId ?? null,
        details: { type, entityId: entityId ?? null },
      });
      try {
        Sentry.withScope((scope) => {
          scope.setTag('layer', 'analytics');
          scope.setTag('type', type);
          if (correlationId) scope.setTag('correlationId', correlationId);
          if (userId) scope.setUser({ id: userId });
          if (entityId) scope.setExtra('entityId', entityId);
          if (metadata) scope.setExtra('metadata', metadata);
          Sentry.captureException(error);
        });
      } catch {}
    });
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

