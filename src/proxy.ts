import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { verifyAuthEdge } from '@/lib/auth-edge'
import { CORRELATION_ID_HEADER, createCorrelationId } from '@/lib/correlation-id'

const locales = ['en', 'fr']
const defaultLocale = 'en'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const protectedRoutes = ['/dashboard', '/api/properties', '/api/contracts']

function withCorrelationHeaders(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId)
  return response
}

function unauthorizedApiResponse(correlationId: string) {
  return withCorrelationHeaders(
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    correlationId
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const correlationId = request.headers.get(CORRELATION_ID_HEADER)?.trim() || createCorrelationId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId)

  const pathWithoutLocale = locales.some((locale) => pathname.startsWith(`/${locale}`))
    ? pathname.slice(3)
    : pathname
  const isProtected = protectedRoutes.some((route) => pathWithoutLocale.startsWith(route))
  const isApiRoute = pathname.startsWith('/api')

  if (isProtected) {
    const token =
      request.cookies.get('token')?.value || request.headers.get('Authorization')?.split(' ')[1]

    if (!token) {
      if (isApiRoute) {
        return unauthorizedApiResponse(correlationId)
      }
      const locale = locales.find((value) => pathname.startsWith(`/${value}`)) || defaultLocale
      return withCorrelationHeaders(
        NextResponse.redirect(new URL(`/${locale}/login`, request.url)),
        correlationId
      )
    }

    const payload = await verifyAuthEdge(token)
    if (!payload) {
      if (isApiRoute) {
        return unauthorizedApiResponse(correlationId)
      }
      const locale = locales.find((value) => pathname.startsWith(`/${value}`)) || defaultLocale
      return withCorrelationHeaders(
        NextResponse.redirect(new URL(`/${locale}/login`, request.url)),
        correlationId
      )
    }
  }

  if (isApiRoute) {
    return withCorrelationHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      correlationId
    )
  }

  const intlResponse = intlMiddleware(request)
  return withCorrelationHeaders(intlResponse, correlationId)
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
