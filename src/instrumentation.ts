function writeInstrumentationError(message: string, error?: unknown) {
  const details =
    error instanceof Error ? `${error.name}: ${error.message}` : error ? String(error) : ''
  console.error(`[monitoring] ${message}${details ? ` (${details})` : ''}`)
}

function resolveReleaseVersion() {
  return (
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    undefined
  )
}

async function initSentryForRuntime() {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return

  try {
    const dynamicImporter = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<{
      init?: (config: Record<string, unknown>) => void
    }>

    const sentry = await dynamicImporter('@sentry/nextjs')
    sentry.init?.({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: resolveReleaseVersion(),
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      sendDefaultPii: false,
    })
  } catch (error) {
    writeInstrumentationError('Unable to initialize Sentry server runtime', error)
  }
}

export async function register() {
  await initSentryForRuntime()
}
