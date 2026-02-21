import { createSystemLog } from '@/lib/audit'
import type { AuthTokenPayload } from '@/lib/auth'
import { logServerEvent } from '@/lib/logger'

type MonitoringContext = {
  scope: string
  actor?: Pick<AuthTokenPayload, 'id' | 'email' | 'role'> | null
  targetType?: string
  targetId?: string
  correlationId?: string
  route?: string
  event?: string
  details?: Record<string, unknown>
}

const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|cookie|set-cookie|signature/i

function resolveMonitoringEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown'
}

function resolveMonitoringRelease() {
  return (
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    undefined
  )
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function scrubSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]'
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(objectValue)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = scrubSensitiveData(nestedValue, depth + 1)
      }
    }
    return result
  }

  return value
}

function compactDetails(details?: Record<string, unknown>): string | null {
  if (!details) return null
  const entries = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
  return entries.length > 0 ? entries.join(';') : null
}

async function sendToSentryIfConfigured(error: unknown, context: MonitoringContext) {
  if (!process.env.SENTRY_DSN) {
    return
  }

  try {
    const dynamicImporter = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<{
      captureException?: (error: unknown, context?: unknown) => void
    }>

    const sentry = await dynamicImporter('@sentry/nextjs')
    const sanitizedDetails = scrubSensitiveData(context.details) as
      | Record<string, unknown>
      | undefined

    sentry.captureException?.(error, {
      tags: {
        scope: context.scope,
        correlationId: context.correlationId,
        route: context.route,
        event: context.event,
        environment: resolveMonitoringEnvironment(),
        release: resolveMonitoringRelease(),
      },
      extra: {
        ...sanitizedDetails,
        targetType: context.targetType,
        targetId: context.targetId,
      },
      user: context.actor
        ? {
            id: context.actor.id,
            email: context.actor.email,
          }
        : undefined,
    })
  } catch (sentryError) {
    logServerEvent({
      level: 'warn',
      event: 'monitoring.sentry.forward.failed',
      correlationId: context.correlationId,
      route: context.route,
      userId: context.actor?.id ?? null,
      details: {
        scope: context.scope,
        error: stringifyError(sentryError),
      },
    })
  }
}

export async function captureServerError(error: unknown, context: MonitoringContext) {
  const serializedError = stringifyError(error)
  const sanitizedDetails = scrubSensitiveData(context.details) as
    | Record<string, unknown>
    | undefined
  const detailsParts = [
    `scope=${context.scope}`,
    `error=${serializedError}`,
    compactDetails(sanitizedDetails),
  ].filter(Boolean)

  await createSystemLog({
    actor: context.actor ?? null,
    action: 'SERVER_ERROR',
    targetType: context.targetType ?? 'SYSTEM',
    targetId: context.targetId,
    correlationId: context.correlationId,
    route: context.route,
    details: detailsParts.join(';').slice(0, 1900),
  })

  logServerEvent({
    level: 'error',
    event: context.event ?? 'server.error',
    correlationId: context.correlationId,
    route: context.route,
    userId: context.actor?.id ?? null,
    details: {
      scope: context.scope,
      targetType: context.targetType,
      targetId: context.targetId,
      error: serializedError,
      ...(sanitizedDetails ?? {}),
    },
  })

  await sendToSentryIfConfigured(error, context)
}
