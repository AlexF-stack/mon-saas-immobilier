import { NextResponse } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function getExpectedOrigin(request: Request): string {
    const urlOrigin = new URL(request.url).origin
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = forwardedHost ?? request.headers.get('host')

    if (!host) {
        return urlOrigin
    }

    const forwardedProto = request.headers.get('x-forwarded-proto')
    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(':', '')
    return `${protocol}://${host}`
}

export function enforceCsrf(request: Request): NextResponse | null {
    const method = request.method.toUpperCase()
    if (SAFE_METHODS.has(method)) {
        return null
    }

    // API calls authenticated via Authorization header are not cookie-bound.
    if (request.headers.get('Authorization')) {
        return null
    }

    const origin = request.headers.get('origin')
    const expectedOrigin = getExpectedOrigin(request)

    if (origin) {
        if (origin !== expectedOrigin) {
            return NextResponse.json(
                { error: 'CSRF validation failed: invalid origin' },
                { status: 403 }
            )
        }
        return null
    }

    const fetchSite = request.headers.get('sec-fetch-site')
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        return NextResponse.json(
            { error: 'CSRF validation failed: invalid fetch site' },
            { status: 403 }
        )
    }

    if (!fetchSite) {
        return NextResponse.json(
            { error: 'CSRF validation failed: missing origin context' },
            { status: 403 }
        )
    }

    return null
}
