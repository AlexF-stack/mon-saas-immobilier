import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceCsrf } from '@/lib/csrf'
import {
    hashPassword,
    normalizeUserRole,
    verifyPasswordResetToken,
} from '@/lib/auth'
import { validatePasswordComplexity } from '@/lib/auth-policy'
import { captureServerError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/security-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resetPasswordSchema = z.object({
    token: z.string().trim().min(1),
    password: z.string().min(8),
})

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const rateLimitError = await enforceRateLimit({
            request,
            bucket: 'AUTH_RESET_PASSWORD',
            limit: 18,
            windowMs: 15 * 60 * 1000,
            message: 'Too many reset attempts. Please retry later.',
        })
        if (rateLimitError) {
            return rateLimitError
        }

        const body = await request.json()
        const parsed = resetPasswordSchema.parse(body)

        if (!validatePasswordComplexity(parsed.password)) {
            return NextResponse.json(
                {
                    error:
                        'Password must contain upper/lower case letters, a number, a special character and be at least 8 characters long',
                },
                { status: 400 }
            )
        }

        const payload = verifyPasswordResetToken(parsed.token)
        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                role: true,
                isSuspended: true,
            },
        })

        if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            )
        }

        const issuedTokenLog = await prisma.systemLog.findFirst({
            where: {
                action: 'PASSWORD_RESET_ISSUED',
                targetType: 'USER',
                targetId: user.id,
                details: {
                    contains: `jti=${payload.jti}`,
                },
            },
            select: { id: true },
        })
        if (!issuedTokenLog) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            )
        }

        const consumedTokenLog = await prisma.systemLog.findFirst({
            where: {
                action: 'PASSWORD_RESET_CONSUMED',
                targetType: 'USER',
                targetId: user.id,
                details: {
                    contains: `jti=${payload.jti}`,
                },
            },
            select: { id: true },
        })
        if (consumedTokenLog) {
            return NextResponse.json(
                { error: 'Reset token already used' },
                { status: 400 }
            )
        }

        if (typeof payload.iat === 'number') {
            const tokenIssuedAt = new Date(payload.iat * 1000)
            const completedAfterIssue = await prisma.systemLog.findFirst({
                where: {
                    action: 'PASSWORD_RESET_COMPLETED',
                    targetType: 'USER',
                    targetId: user.id,
                    createdAt: {
                        gte: tokenIssuedAt,
                    },
                },
                select: { id: true },
            })

            if (completedAfterIssue) {
                return NextResponse.json(
                    { error: 'Reset token already invalidated by a newer password change' },
                    { status: 400 }
                )
            }
        }

        if (user.isSuspended) {
            return NextResponse.json(
                { error: 'Account suspended. Contact an administrator.' },
                { status: 403 }
            )
        }

        const normalizedRole = normalizeUserRole(user.role) ?? 'TENANT'
        const hashedPassword = await hashPassword(parsed.password)
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                },
            }),
            prisma.systemLog.create({
                data: {
                    actorId: user.id,
                    actorEmail: user.email,
                    actorRole: normalizedRole,
                    action: 'PASSWORD_RESET_CONSUMED',
                    targetType: 'USER',
                    targetId: user.id,
                    details: `jti=${payload.jti}`,
                },
            }),
            prisma.systemLog.create({
                data: {
                    actorId: user.id,
                    actorEmail: user.email,
                    actorRole: normalizedRole,
                    action: 'PASSWORD_RESET_COMPLETED',
                    targetType: 'USER',
                    targetId: user.id,
                },
            }),
        ])
        return NextResponse.json({ message: 'Password reset successful' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }

        await captureServerError(error, {
            scope: 'reset_password',
            targetType: 'AUTH',
        })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
