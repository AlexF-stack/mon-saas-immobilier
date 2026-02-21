import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPPORTED_LOCALES = new Set(['en', 'fr'])

function getLocaleFromRequest(request: Request): string | null {
  const headerLocale = request.headers.get('x-locale')?.trim().toLowerCase()
  if (headerLocale && SUPPORTED_LOCALES.has(headerLocale)) {
    return headerLocale
  }

  const referer = request.headers.get('referer')
  if (!referer) return null

  try {
    const pathname = new URL(referer).pathname
    const match = pathname.match(/^\/(en|fr)(?=\/|$)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const locale = getLocaleFromRequest(request)
    const redirectTo = locale ? `/${locale}/login` : '/login'

    const cookieStore = await cookies()
    cookieStore.delete('token')

    const wantsJson =
        request.headers.get('x-requested-with') === 'fetch' ||
        request.headers.get('accept')?.includes('application/json')

    if (wantsJson) {
        return NextResponse.json({ ok: true, redirectTo })
    }

    return NextResponse.redirect(new URL(redirectTo, request.url))
}
