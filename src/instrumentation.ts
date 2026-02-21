function writeInstrumentationError(message: string, error?: unknown) {
  const details =
    error instanceof Error ? `${error.name}: ${error.message}` : error ? String(error) : ''
  process.stderr.write(`[monitoring] ${message}${details ? ` (${details})` : ''}\n`)
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
