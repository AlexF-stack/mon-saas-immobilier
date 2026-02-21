type SentryUser = {
  id?: string
  email?: string
}

let initialized = false
let sentryModulePromise: Promise<{
  init?: (config: Record<string, unknown>) => void
  setUser?: (user: SentryUser | null) => void
  captureException?: (error: unknown, context?: unknown) => void
}> | null = null

function resolveClientRelease() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    undefined
  )
}

function getSentryModule() {
  if (!sentryModulePromise) {
    const dynamicImporter = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<{
      init?: (config: Record<string, unknown>) => void
      setUser?: (user: SentryUser | null) => void
      captureException?: (error: unknown, context?: unknown) => void
    }>
    sentryModulePromise = dynamicImporter('@sentry/nextjs')
  }
  return sentryModulePromise
}

export async function initClientMonitoring() {
  if (initialized) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return

  try {
    const sentry = await getSentryModule()
    sentry.init?.({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      release: resolveClientRelease(),
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      sendDefaultPii: false,
    })
    initialized = true
  } catch {
    // Non-fatal: monitoring should never break client runtime.
  }
}

export async function setMonitoringUser(user: SentryUser | null) {
  try {
    await initClientMonitoring()
    const sentry = await getSentryModule()
    sentry.setUser?.(user)
  } catch {
    // Silent by design.
  }
}

export async function captureClientException(error: unknown, context?: Record<string, unknown>) {
  try {
    await initClientMonitoring()
    const sentry = await getSentryModule()
    sentry.captureException?.(error, { extra: context })
  } catch {
    // Silent by design.
  }
}
