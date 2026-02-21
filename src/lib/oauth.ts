import crypto from 'crypto'

export type OAuthProvider = 'google' | 'facebook'

type ProviderConfig = {
    provider: OAuthProvider
    clientId: string
    clientSecret: string
}

export type OAuthIdentity = {
    email: string
    name: string | null
    emailVerified: boolean
}

function normalizeProvider(value: string): OAuthProvider | null {
    if (value === 'google' || value === 'facebook') {
        return value
    }
    return null
}

export function getOAuthProvider(value: string): OAuthProvider | null {
    return normalizeProvider(value.trim().toLowerCase())
}

export function getOAuthConfig(provider: OAuthProvider): ProviderConfig | null {
    if (provider === 'google') {
        const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
        if (!clientId || !clientSecret) return null
        return { provider, clientId, clientSecret }
    }

    const clientId = process.env.FACEBOOK_CLIENT_ID?.trim()
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) return null
    return { provider, clientId, clientSecret }
}

export function createOAuthState() {
    return crypto.randomBytes(24).toString('hex')
}

export function getRequestOrigin(request: Request) {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = forwardedHost ?? request.headers.get('host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    if (!host) {
        return new URL(request.url).origin
    }

    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(':', '')
    return `${protocol}://${host}`
}

export function getOAuthCallbackUrl(request: Request, provider: OAuthProvider) {
    return `${getRequestOrigin(request)}/api/auth/oauth/${provider}/callback`
}

export function buildOAuthAuthorizeUrl(params: {
    provider: OAuthProvider
    request: Request
    state: string
}) {
    const config = getOAuthConfig(params.provider)
    if (!config) return null

    const callbackUrl = getOAuthCallbackUrl(params.request, params.provider)

    if (params.provider === 'google') {
        const search = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: callbackUrl,
            response_type: 'code',
            scope: 'openid email profile',
            state: params.state,
            access_type: 'online',
            prompt: 'select_account',
        })
        return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`
    }

    const search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'email,public_profile',
        state: params.state,
    })
    return `https://www.facebook.com/v20.0/dialog/oauth?${search.toString()}`
}

async function exchangeGoogleCodeForIdentity(
    request: Request,
    config: ProviderConfig,
    code: string
): Promise<OAuthIdentity | null> {
    const callbackUrl = getOAuthCallbackUrl(request, 'google')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
        }),
        cache: 'no-store',
    })

    if (!tokenResponse.ok) {
        return null
    }

    const tokenData = (await tokenResponse.json()) as {
        access_token?: string
    }

    if (!tokenData.access_token) {
        return null
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
        },
        cache: 'no-store',
    })

    if (!userInfoResponse.ok) {
        return null
    }

    const userInfo = (await userInfoResponse.json()) as {
        email?: string
        name?: string
        email_verified?: boolean
    }

    if (!userInfo.email || userInfo.email_verified !== true) {
        return null
    }

    return {
        email: userInfo.email.toLowerCase(),
        name: userInfo.name ?? null,
        emailVerified: true,
    }
}

async function exchangeFacebookCodeForIdentity(
    request: Request,
    config: ProviderConfig,
    code: string
): Promise<OAuthIdentity | null> {
    const callbackUrl = getOAuthCallbackUrl(request, 'facebook')
    const tokenSearch = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: callbackUrl,
        code,
    })
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?${tokenSearch.toString()}`
    const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' })

    if (!tokenResponse.ok) {
        return null
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string }
    if (!tokenData.access_token) {
        return null
    }

    const userInfoSearch = new URLSearchParams({
        fields: 'id,name,email',
        access_token: tokenData.access_token,
    })
    const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?${userInfoSearch.toString()}`,
        { cache: 'no-store' }
    )

    if (!userInfoResponse.ok) {
        return null
    }

    const userInfo = (await userInfoResponse.json()) as {
        email?: string
        name?: string
    }

    if (!userInfo.email) {
        return null
    }

    return {
        email: userInfo.email.toLowerCase(),
        name: userInfo.name ?? null,
        emailVerified: true,
    }
}

export async function exchangeOAuthCodeForIdentity(params: {
    provider: OAuthProvider
    request: Request
    code: string
}) {
    const config = getOAuthConfig(params.provider)
    if (!config) return null

    if (params.provider === 'google') {
        return exchangeGoogleCodeForIdentity(params.request, config, params.code)
    }

    return exchangeFacebookCodeForIdentity(params.request, config, params.code)
}
