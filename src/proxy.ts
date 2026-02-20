import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuthEdge } from '@/lib/auth-edge'
import createMiddleware from 'next-intl/middleware'

const locales = ['en', 'fr']
const defaultLocale = 'en'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const protectedRoutes = ['/dashboard', '/api/properties', '/api/contracts']

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Let next-intl handle locale prefix - it will redirect non-localized URLs
    // Don't do additional redirects here as it causes loops
    const intlResponse = intlMiddleware(request)

    // Check intlResponse status - if it's a redirect, let it through
    if (intlResponse.status >= 300 && intlResponse.status < 400) {
        return intlResponse
    }

    // Extract locale from pathname for auth checks
    const pathWithoutLocale = locales.some(locale => pathname.startsWith(`/${locale}`))
        ? pathname.slice(3) // Remove /{locale}
        : pathname

    // Check if route is protected
    const isProtected = protectedRoutes.some(route => pathWithoutLocale.startsWith(route))

    if (isProtected) {
        const token = request.cookies.get('token')?.value || request.headers.get('Authorization')?.split(' ')[1]

        if (!token) {
            if (pathWithoutLocale.startsWith('/api')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            const locale = locales.find(l => pathname.startsWith(`/${l}`)) || defaultLocale
            return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
        }

        const payload = await verifyAuthEdge(token)

        if (!payload) {
            if (pathWithoutLocale.startsWith('/api')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            const locale = locales.find(l => pathname.startsWith(`/${l}`)) || defaultLocale
            return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
        }
    }

    return intlResponse
}

export const config = {
    matcher: ['/((?!_next|api|.*\\..*).*)'],
}
