import { getCorrelationIdFromRequest } from '@/lib/correlation-id'

type LogLevel = 'info' | 'warn' | 'error'

type LogEntry = {
  level?: LogLevel
  event: string
  message?: string
  correlationId?: string
  userId?: string | null
  route?: string
  details?: Record<string, unknown>
}

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|set-cookie|signature|jwt|iban|accountnumber|account_number/i

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]'

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = sanitizeValue(nested, depth + 1)
      }
    }
    return result
  }

  return value
}

function writeJsonLog(level: LogLevel, payload: Record<string, unknown>) {
  const line = `${JSON.stringify(payload)}\n`
  if (
    typeof process === 'undefined' ||
    !process.stdout ||
    typeof process.stdout.write !== 'function'
  ) {
    if (level === 'error') {
      console.error(payload)
      return
    }
    if (level === 'warn') {
      console.warn(payload)
      return
    }
    console.info(payload)
    return
  }

  if (level === 'error') {
    process.stderr.write(line)
    return
  }
  process.stdout.write(line)
}

function requestRoute(request: Request): string {
  try {
    return new URL(request.url).pathname
  } catch {
    return 'unknown'
  }
}

export function getLogContextFromRequest(request: Request, userId?: string | null) {
  return {
    correlationId: getCorrelationIdFromRequest(request),
    route: requestRoute(request),
    userId: userId ?? null,
  }
}

export function logServerEvent(entry: LogEntry) {
  const level = entry.level ?? 'info'
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: entry.event,
    message: entry.message ?? null,
    correlationId: entry.correlationId ?? null,
    userId: entry.userId ?? null,
    route: entry.route ?? null,
    details: sanitizeValue(entry.details ?? null),
  }

  writeJsonLog(level, payload)
}
