import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken, isUserRole } from '@/lib/auth'
import {
    getDashboardPathForRole,
    normalizeRequestedRole,
    validatePasswordComplexity,
} from '@/lib/auth-policy'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { z } from 'zod'

const registerSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    name: z.string().optional(),
    role: z.string().optional(),
})

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const body = await request.json()
        const parsed = registerSchema.parse(body)
        const email = parsed.email.toLowerCase()
        const password = parsed.password
        const name = parsed.name?.trim()

        if (!validatePasswordComplexity(password)) {
            return NextResponse.json(
                {
                    error:
                        'Password must contain upper/lower case letters, a number, a special character and be at least 8 characters long',
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
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
