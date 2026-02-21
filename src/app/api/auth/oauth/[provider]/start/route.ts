import { NextResponse } from 'next/server'
import { buildOAuthAuthorizeUrl, createOAuthState, getOAuthProvider } from '@/lib/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSafeLocale(value: string | null) {
    return value === 'fr' ? 'fr' : 'en'
}

export async function GET(
    request: Request,
    context: { params: Promise<{ provider: string }> | { provider: string } }
) {
    const resolvedParams = await Promise.resolve(context.params)
    const provider = getOAuthProvider(resolvedParams.provider)

    if (!provider) {
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    const requestUrl = new URL(request.url)
    const locale = getSafeLocale(requestUrl.searchParams.get('locale'))
    const state = createOAuthState()
    const authorizeUrl = buildOAuthAuthorizeUrl({
        provider,
        request,
        state,
    })

    if (!authorizeUrl) {
        const fallback = `/${locale}/login?error=oauth_not_configured`
        return NextResponse.redirect(new URL(fallback, request.url))
    }

    const response = NextResponse.redirect(authorizeUrl)
    response.cookies.set(`oauth_state_${provider}`, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
    })
    response.cookies.set(`oauth_locale_${provider}`, locale, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
    })

    return response
}
