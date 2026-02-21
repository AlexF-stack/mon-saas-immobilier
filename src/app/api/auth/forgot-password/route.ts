import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { generatePasswordResetToken } from '@/lib/auth'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const forgotPasswordSchema = z.object({
    email: z.string().trim().email(),
    locale: z.string().optional(),
})

function getRequestOrigin(request: Request) {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = forwardedHost ?? request.headers.get('host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    if (!host) {
        return new URL(request.url).origin
    }

    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(':', '')
    return `${protocol}://${host}`
}

function normalizeLocale(value: string | undefined) {
    return value === 'fr' ? 'fr' : 'en'
}

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const rateLimitError = await enforceRateLimit({
            request,
            bucket: 'AUTH_FORGOT_PASSWORD',
            limit: 12,
            windowMs: 15 * 60 * 1000,
            message: 'Too many password reset requests. Please retry later.',
        })
        if (rateLimitError) {
            return rateLimitError
        }

        const body = await request.json()
        const parsed = forgotPasswordSchema.parse(body)
        const email = parsed.email.toLowerCase()
        const locale = normalizeLocale(parsed.locale)

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive',
                },
            },
            select: {
                id: true,
                email: true,
            },
        })

        if (user) {
            const jti = crypto.randomUUID()
            const token = generatePasswordResetToken({
                id: user.id,
                email: user.email,
                jti,
            })
            const resetUrl = `${getRequestOrigin(
                request
            )}/${locale}/reset-password?token=${encodeURIComponent(token)}`

            await createSystemLog({
                action: 'PASSWORD_RESET_ISSUED',
                targetType: 'USER',
                targetId: user.id,
                details: `jti=${jti}`,
            })

            if (process.env.NODE_ENV !== 'production') {
                return NextResponse.json({
                    message:
                        'If the email exists, a reset link has been generated.',
                    resetUrl,
                })
            }
        }

        return NextResponse.json({
            message:
                'If the email exists, a password reset link has been sent.',
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }

        await captureServerError(error, {
            scope: 'forgot_password',
            targetType: 'AUTH',
        })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
