import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken, isUserRole } from '@/lib/auth'
import {
    getDashboardPathForRole,
    normalizeRequestedRole,
    validateRegistrationPassword,
} from '@/lib/auth-policy'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { getCorrelationIdFromRequest } from '@/lib/correlation-id'
import { trackEvent } from '@/lib/analytics/track-event'
import { captureServerError } from '@/lib/monitoring'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const registerSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(6),
    name: z.string().optional(),
    role: z.string().optional(),
})

const MIN_JWT_SECRET_LENGTH = 32

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
        const parsed = registerSchema.parse(body)
        const email = parsed.email.toLowerCase()
        const password = parsed.password
        const name = parsed.name?.trim()

        if (!validateRegistrationPassword(password)) {
            return NextResponse.json(
                {
                    error: 'Mot de passe trop court (minimum 6 caracteres).',
                },
                { status: 400 }
            )
        }

        const roleResult = normalizeRequestedRole(parsed.role)
        if (!roleResult.ok) {
            return NextResponse.json({ error: roleResult.error }, { status: 400 })
        }
        const role = roleResult.internalRole

        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists' },
                { status: 400 }
            )
        }

        const hashedPassword = await hashPassword(password)

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                isSuspended: false,
            },
        })

        if (!isUserRole(user.role)) {
            return NextResponse.json({ error: 'Invalid role in database' }, { status: 500 })
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        })

        const { password: removedPassword, ...userWithoutPassword } = user
        void removedPassword

        const response = NextResponse.json(
            {
                user: userWithoutPassword,
                redirectTo: getDashboardPathForRole(user.role),
            },
            { status: 201 }
        )

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400,
            path: '/',
        })

        await createSystemLog({
            actor: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            action: 'USER_REGISTERED',
            targetType: 'USER',
            targetId: user.id,
            correlationId,
            route: '/api/auth/register',
        })

        // Non-blocking analytics capture for signup.
        void trackEvent({
            type: 'SIGNUP',
            userId: user.id,
            metadata: {
                role: user.role,
            },
            correlationId,
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        const correlationId = getCorrelationIdFromRequest(request)
        await captureServerError(error, {
            scope: 'auth_register',
            targetType: 'AUTH',
            correlationId,
            route: '/api/auth/register',
        })
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
