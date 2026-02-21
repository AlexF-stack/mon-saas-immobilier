export const CORRELATION_ID_HEADER = 'x-correlation-id'
const REQUEST_CORRELATION_IDS = new WeakMap<Request, string>()

function fallbackCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function createCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return fallbackCorrelationId()
}

export function getCorrelationIdFromHeaders(headers: Headers): string {
  const existing = headers.get(CORRELATION_ID_HEADER)?.trim()
  if (existing) return existing
  return createCorrelationId()
}

export function getCorrelationIdFromRequest(request: Request): string {
  const fromHeaders = request.headers.get(CORRELATION_ID_HEADER)?.trim()
  if (fromHeaders) return fromHeaders

  const existing = REQUEST_CORRELATION_IDS.get(request)
  if (existing) return existing

  const created = createCorrelationId()
  REQUEST_CORRELATION_IDS.set(request, created)
  return created
}

export function setCorrelationIdOnResponse<T extends Response>(response: T, correlationId: string): T {
  response.headers.set(CORRELATION_ID_HEADER, correlationId)
  return response
}
