import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken, isUserRole } from '@/lib/auth'
import { getDashboardPathForRole } from '@/lib/auth-policy'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { z } from 'zod'

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string(),
})

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const body = await request.json()
        const parsed = loginSchema.parse(body)
        const email = parsed.email.toLowerCase()
        const password = parsed.password

        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        const isValidPassword = await comparePassword(password, user.password)

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        if (user.isSuspended) {
            await createSystemLog({
                action: 'LOGIN_BLOCKED_SUSPENDED',
                targetType: 'USER',
                targetId: user.id,
                details: `email=${user.email}`,
            })

            return NextResponse.json(
                { error: 'Account suspended. Contact an administrator.' },
                { status: 403 }
            )
        }

        if (!isUserRole(user.role)) {
            return NextResponse.json(
                { error: 'Invalid role in database' },
                { status: 500 }
            )
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        })

        const { password: removedPassword, ...userWithoutPassword } = user
        void removedPassword

        const response = NextResponse.json({
            user: userWithoutPassword,
            redirectTo: getDashboardPathForRole(user.role),
        })

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
            action: 'LOGIN_SUCCESS',
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
