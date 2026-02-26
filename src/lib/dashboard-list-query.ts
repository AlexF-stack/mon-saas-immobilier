export type QueryParamValue = string | string[] | undefined

export function firstValue(value: QueryParamValue): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function toPositiveInt(value: string, fallback = 1): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

export function normalizePage(value: QueryParamValue): number {
  return toPositiveInt(firstValue(value), 1)
}

export function normalizeText(value: QueryParamValue): string {
  return firstValue(value).trim()
}

export function normalizeEnum(
  value: QueryParamValue,
  accepted: readonly string[],
  fallback = ''
): string {
  const raw = firstValue(value).trim().toUpperCase()
  if (!raw) return fallback
  return accepted.includes(raw) ? raw : fallback
}

export function buildPageHref(
  basePath: string,
  filters: Record<string, string>,
  targetPage: number
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (targetPage > 1) params.set('page', String(targetPage))

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
