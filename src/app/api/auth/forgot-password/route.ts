import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { generatePasswordResetToken } from '@/lib/auth'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { getCorrelationIdFromRequest } from '@/lib/correlation-id'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const forgotPasswordSchema = z.object({
    email: z.string().trim().email(),
    locale: z.string().optional(),
})

const MIN_JWT_SECRET_LENGTH = 32

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

async function sendResetEmail(input: {
    to: string
    resetUrl: string
    locale: 'fr' | 'en'
    correlationId?: string
}) {
    const webhookUrl =
        process.env.AUTH_EMAIL_WEBHOOK_URL?.trim() ||
        process.env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim() ||
        process.env.PAYMENT_REMINDER_EMAIL_WEBHOOK_URL?.trim()

    if (!webhookUrl) {
        await createSystemLog({
            action: 'PASSWORD_RESET_EMAIL_SKIPPED',
            targetType: 'AUTH',
            details: `reason=missing_webhook;email=${input.to}`,
            correlationId: input.correlationId,
        })
        return { sent: false, reason: 'missing_webhook' }
    }

    const subject =
        input.locale === 'fr'
            ? 'Reinitialisation du mot de passe'
            : 'Password reset'
    const body =
        input.locale === 'fr'
            ? `Bonjour,\n\nPour reinitialiser votre mot de passe, cliquez sur ce lien :\n${input.resetUrl}\n\nSi vous n etes pas a l origine de cette demande, ignorez cet email.\n`
            : `Hello,\n\nTo reset your password, click this link:\n${input.resetUrl}\n\nIf you did not request this, you can ignore this email.\n`

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: 'email',
                to: input.to,
                subject,
                message: body,
            }),
        })

        if (!response.ok) {
            await createSystemLog({
                action: 'PASSWORD_RESET_EMAIL_FAILED',
                targetType: 'AUTH',
                details: `reason=http_${response.status};email=${input.to}`,
                correlationId: input.correlationId,
            })
            return { sent: false, reason: `http_${response.status}` }
        }

        return { sent: true }
    } catch (error) {
        await createSystemLog({
            action: 'PASSWORD_RESET_EMAIL_FAILED',
            targetType: 'AUTH',
            details: `reason=network_error;email=${input.to}`,
            correlationId: input.correlationId,
        })
        return { sent: false, reason: 'network_error' }
    }
}

export async function POST(request: Request) {
    try {
        const correlationId = getCorrelationIdFromRequest(request)
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

        if (process.env.NODE_ENV === 'production') {
            const resetSecret = process.env.PASSWORD_RESET_JWT_SECRET
            if (!resetSecret || resetSecret.length < MIN_JWT_SECRET_LENGTH) {
                return NextResponse.json(
                    { error: 'Configuration serveur incomplete. Contactez un administrateur.' },
                    { status: 503 }
                )
            }
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
                correlationId,
                details: `jti=${jti}`,
            })

            await sendResetEmail({
                to: user.email,
                resetUrl,
                locale,
                correlationId,
            })

            if (
                process.env.NODE_ENV !== 'production' ||
                process.env.ALLOW_RESET_URL_RESPONSE === 'true'
            ) {
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
            correlationId: getCorrelationIdFromRequest(request),
            route: '/api/auth/forgot-password',
        })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
