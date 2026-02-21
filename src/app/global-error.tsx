'use client'

import { useEffect } from 'react'
import { captureClientException } from '@/lib/monitoring-client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    void captureClientException(error, {
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
  }, [error])

  return (
    <html>
      <body className="bg-background text-primary">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
          <p className="text-sm text-secondary">
            L incident a ete enregistre. Vous pouvez reessayer.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reessayer
          </button>
        </main>
      </body>
    </html>
  )
}
