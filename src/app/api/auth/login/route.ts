import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken, hashPassword, normalizeUserRole } from '@/lib/auth'
import { getDashboardPathForRole } from '@/lib/auth-policy'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { getCorrelationIdFromRequest } from '@/lib/correlation-id'
import { getClientIpFromHeaders } from '@/lib/request-metadata'
import {
    buildRateLimitFingerprint,
    countRateLimitEvents,
    enforceRateLimit,
    recordRateLimitEvent,
} from '@/lib/security-rate-limit'
import { ensureBootstrapAdmin } from '@/lib/admin-bootstrap'
import { captureServerError } from '@/lib/monitoring'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string(),
})

const LOGIN_GLOBAL_BUCKET = 'AUTH_LOGIN_GLOBAL'
const LOGIN_BRUTE_FORCE_BUCKET = 'AUTH_LOGIN_FAILED'
const LOGIN_GLOBAL_LIMIT = 30
const LOGIN_GLOBAL_WINDOW_MS = 10 * 60 * 1000
const LOGIN_BRUTE_FORCE_LIMIT = 6
const LOGIN_BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000
const MIN_JWT_SECRET_LENGTH = 32

function looksLikeBcryptHash(value: string) {
    return /^\$2[aby]\$\d{2}\$/.test(value)
}

export async function POST(request: Request) {
    try {
        const correlationId = getCorrelationIdFromRequest(request)
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        if (process.env.NODE_ENV === 'production') {
            const jwtSecret = process.env.JWT_SECRET
            if (!jwtSecret || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
                return NextResponse.json(
                    { error: 'Configuration serveur incomplete. Contactez un administrateur.' },
                    { status: 503 }
                )
            }
        }

        const body = await request.json()
        const parsed = loginSchema.parse(body)
        const email = parsed.email.toLowerCase()
        const password = parsed.password
        const ipAddress = getClientIpFromHeaders(request.headers)
        const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null

        const globalLimitError = await enforceRateLimit({
            request,
            bucket: LOGIN_GLOBAL_BUCKET,
            limit: LOGIN_GLOBAL_LIMIT,
            windowMs: LOGIN_GLOBAL_WINDOW_MS,
            extraKey: `login:${ipAddress ?? 'unknown'}`,
            message: 'Too many login attempts. Please retry in a few minutes.',
        })
        if (globalLimitError) {
            return globalLimitError
        }

        const bruteForceFingerprint = buildRateLimitFingerprint(
            request,
            LOGIN_BRUTE_FORCE_BUCKET,
            email
        )
        const failedAttempts = await countRateLimitEvents(
            LOGIN_BRUTE_FORCE_BUCKET,
            bruteForceFingerprint,
            LOGIN_BRUTE_FORCE_WINDOW_MS
        )
        if (failedAttempts >= LOGIN_BRUTE_FORCE_LIMIT) {
            await createSystemLog({
                action: 'LOGIN_BRUTE_FORCE_BLOCKED',
                targetType: 'AUTH',
                correlationId,
                details: `email=${email};ip=${ipAddress ?? 'none'}`,
            })
            return NextResponse.json(
                {
                    error: 'Account temporarily locked due to repeated failed attempts. Retry later.',
                },
                { status: 429 }
            )
        }

        await ensureBootstrapAdmin(email)

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive',
                },
            },
        })

        if (!user) {
            await recordRateLimitEvent(
                LOGIN_BRUTE_FORCE_BUCKET,
                bruteForceFingerprint
            )
            await createSystemLog({
                action: 'LOGIN_FAILED_UNKNOWN_EMAIL',
                targetType: 'AUTH',
                correlationId,
                details: `email=${email};ip=${ipAddress ?? 'none'}`,
            })
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        let isValidPassword = false
        let upgradedPasswordHash: string | null = null

        if (looksLikeBcryptHash(user.password)) {
            try {
                isValidPassword = await comparePassword(password, user.password)
            } catch {
                isValidPassword = false
            }
        } else if (user.password === password) {
            // Backward compatibility: migrate legacy plain-text passwords on first successful login.
            isValidPassword = true
            upgradedPasswordHash = await hashPassword(password)
        }

        if (!isValidPassword) {
            await recordRateLimitEvent(
                LOGIN_BRUTE_FORCE_BUCKET,
                bruteForceFingerprint
            )
            try {
                await prisma.loginHistory.create({
                    data: {
                        userId: user.id,
                        ipAddress,
                        userAgent,
                        success: false,
                    },
                })
            } catch (error) {
                await captureServerError(error, {
                    scope: 'auth_login_history',
                    targetType: 'AUTH',
                    correlationId,
                    route: '/api/auth/login',
                })
            }
            await createSystemLog({
                actor: {
                    id: user.id,
                    email: user.email,
                    role: normalizeUserRole(user.role) ?? 'TENANT',
                },
                action: 'LOGIN_FAILED_BAD_PASSWORD',
                targetType: 'USER',
                targetId: user.id,
                correlationId,
                details: `ip=${ipAddress ?? 'none'}`,
            })
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        if (user.isSuspended) {
            try {
                await prisma.loginHistory.create({
                    data: {
                        userId: user.id,
                        ipAddress,
                        userAgent,
                        success: false,
                    },
                })
            } catch (error) {
                await captureServerError(error, {
                    scope: 'auth_login_history',
                    targetType: 'AUTH',
                    correlationId,
                    route: '/api/auth/login',
                })
            }
            await createSystemLog({
                action: 'LOGIN_BLOCKED_SUSPENDED',
                targetType: 'USER',
                targetId: user.id,
                correlationId,
                details: `email=${user.email};ip=${ipAddress ?? 'none'}`,
            })

            return NextResponse.json(
                { error: 'Account suspended. Contact an administrator.' },
                { status: 403 }
            )
        }

        const normalizedRole = normalizeUserRole(user.role)
        if (!normalizedRole) {
            return NextResponse.json(
                { error: 'Invalid role in database' },
                { status: 500 }
            )
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: normalizedRole,
            name: user.name,
        })

        const { password: removedPassword, ...userWithoutPasswordRaw } = user
        void removedPassword
        const userWithoutPassword = {
            ...userWithoutPasswordRaw,
            role: normalizedRole,
        }

        const response = NextResponse.json({
            user: userWithoutPassword,
            redirectTo: getDashboardPathForRole(normalizedRole),
        })

        const cookieName = `token_${normalizedRole.toLowerCase()}`
        response.cookies.set(cookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400,
            path: '/',
        })

        // Also set generic token for backward compatibility
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400,
            path: '/',
        })

        const userUpdateData: {
            lastLoginAt: Date
            role?: string
            password?: string
        } = {
            lastLoginAt: new Date(),
        }

        if (user.role !== normalizedRole) {
            userUpdateData.role = normalizedRole
        }

        if (upgradedPasswordHash) {
            userUpdateData.password = upgradedPasswordHash
        }

        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: user.id },
                    data: userUpdateData,
                }),
                prisma.loginHistory.create({
                    data: {
                        userId: user.id,
                        ipAddress,
                        userAgent,
                        success: true,
                    },
                }),
            ])
        } catch (error) {
            await captureServerError(error, {
                scope: 'auth_login_persist',
                targetType: 'AUTH',
                correlationId,
                route: '/api/auth/login',
            })

            try {
                await prisma.user.update({
                    where: { id: user.id },
                    data: userUpdateData,
                })
            } catch (fallbackError) {
                await captureServerError(fallbackError, {
                    scope: 'auth_login_persist_fallback',
                    targetType: 'AUTH',
                    correlationId,
                    route: '/api/auth/login',
                })
            }
        }

        await createSystemLog({
            actor: {
                id: user.id,
                email: user.email,
                role: normalizedRole,
            },
            action: 'LOGIN_SUCCESS',
            targetType: 'USER',
            targetId: user.id,
            correlationId,
            details: `ip=${ipAddress ?? 'none'}`,
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        const correlationId = getCorrelationIdFromRequest(request)
        await captureServerError(error, {
            scope: 'auth_login',
            targetType: 'AUTH',
            correlationId,
            route: '/api/auth/login',
        })
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
