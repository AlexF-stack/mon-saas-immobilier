'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const SUPPORTED_LOCALES = new Set(['en', 'fr'])

function detectLocalePrefix(pathname: string | null): string {
  if (!pathname) return ''
  const firstSegment = pathname.split('/')[1] ?? ''
  if (!SUPPORTED_LOCALES.has(firstSegment)) return ''
  return `/${firstSegment}`
}

type LogoutResponse = {
  redirectTo?: string
}

export function useLogout() {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const localePrefix = useMemo(() => detectLocalePrefix(pathname), [pathname])

  async function logout() {
    if (loading) return

    setLoading(true)
    const fallbackRedirect = `${localePrefix || ''}/login`

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'fetch',
          'X-Locale': localePrefix.replace('/', ''),
        },
      })

      let redirectTo = fallbackRedirect
      try {
        const payload = (await response.json()) as LogoutResponse
        if (typeof payload.redirectTo === 'string' && payload.redirectTo.startsWith('/')) {
          redirectTo = payload.redirectTo
        }
      } catch {
        // Ignore malformed payload and keep fallback redirect.
      }

      router.replace(redirectTo)
      router.refresh()
    } catch {
      router.replace(fallbackRedirect)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return { logout, loading }
}

