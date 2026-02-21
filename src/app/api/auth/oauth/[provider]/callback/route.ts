import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    exchangeOAuthCodeForIdentity,
    getOAuthProvider,
} from '@/lib/oauth'
import {
    generateToken,
    hashPassword,
    normalizeUserRole,
} from '@/lib/auth'
import { getDashboardPathForRole } from '@/lib/auth-policy'
import { createSystemLog } from '@/lib/audit'
import { captureServerError } from '@/lib/monitoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSafeLocale(value: string | null) {
    return value === 'fr' ? 'fr' : 'en'
}

function redirectToLogin(
    request: Request,
    locale: string,
    errorCode: string
) {
    const url = new URL(`/${locale}/login`, request.url)
    url.searchParams.set('error', errorCode)
    return NextResponse.redirect(url)
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
    const code = requestUrl.searchParams.get('code')
    const state = requestUrl.searchParams.get('state')
    const providerError = requestUrl.searchParams.get('error')
    const cookieHeader = request.headers.get('cookie') ?? ''

    const stateCookie = cookieHeader
        .match(new RegExp(`oauth_state_${provider}=([^;]+)`))?.[1]
        ?.trim()
    const localeCookie = cookieHeader
        .match(new RegExp(`oauth_locale_${provider}=([^;]+)`))?.[1]
        ?.trim()
    const locale = getSafeLocale(localeCookie ?? requestUrl.searchParams.get('locale'))

    if (providerError) {
        return redirectToLogin(request, locale, 'oauth_denied')
    }

    if (!code || !state || !stateCookie || state !== stateCookie) {
        return redirectToLogin(request, locale, 'oauth_state')
    }

    try {
        const identity = await exchangeOAuthCodeForIdentity({
            provider,
            request,
            code,
        })

        if (!identity?.email || identity.emailVerified !== true) {
            return redirectToLogin(request, locale, 'oauth_profile')
        }

        let user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: identity.email,
                    mode: 'insensitive',
                },
            },
        })

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: identity.email,
                    name: identity.name,
                    role: 'TENANT',
                    isSuspended: false,
                    password: await hashPassword(
                        crypto.randomBytes(32).toString('base64url')
                    ),
                },
            })
        }

        if (user.isSuspended) {
            return redirectToLogin(request, locale, 'suspended')
        }

        const normalizedRole = normalizeUserRole(user.role)
        if (!normalizedRole) {
            return redirectToLogin(request, locale, 'oauth_role')
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: normalizedRole,
            name: user.name,
        })

        if (user.role !== normalizedRole) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: normalizedRole, lastLoginAt: new Date() },
            })
        } else {
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            })
        }

        await createSystemLog({
            actor: {
                id: user.id,
                email: user.email,
                role: normalizedRole,
            },
            action: 'LOGIN_SUCCESS_OAUTH',
            targetType: 'USER',
            targetId: user.id,
            details: `provider=${provider}`,
        })

        const redirectPath = `/${locale}${getDashboardPathForRole(normalizedRole)}`
        const response = NextResponse.redirect(new URL(redirectPath, request.url))

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400,
            path: '/',
        })
        response.cookies.set(`oauth_state_${provider}`, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        })
        response.cookies.set(`oauth_locale_${provider}`, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        })

        return response
    } catch (error) {
        await captureServerError(error, {
            scope: 'oauth_callback',
            targetType: 'AUTH',
            details: { provider },
        })
        return redirectToLogin(request, locale, 'oauth_failed')
    }
}
