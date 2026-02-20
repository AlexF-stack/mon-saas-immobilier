import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken, isUserRole } from '@/lib/auth'
import { getDashboardPathForRole } from '@/lib/auth-policy'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { getClientIpFromHeaders } from '@/lib/request-metadata'
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
        const ipAddress = getClientIpFromHeaders(request.headers)
        const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null

        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            await createSystemLog({
                action: 'LOGIN_FAILED_UNKNOWN_EMAIL',
                targetType: 'AUTH',
                details: `email=${email};ip=${ipAddress ?? 'none'}`,
            })
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        const isValidPassword = await comparePassword(password, user.password)

        if (!isValidPassword) {
            await prisma.loginHistory.create({
                data: {
                    userId: user.id,
                    ipAddress,
                    userAgent,
                    success: false,
                },
            })
            await createSystemLog({
                actor: {
                    id: user.id,
                    email: user.email,
                    role: isUserRole(user.role) ? user.role : 'TENANT',
                },
                action: 'LOGIN_FAILED_BAD_PASSWORD',
                targetType: 'USER',
                targetId: user.id,
                details: `ip=${ipAddress ?? 'none'}`,
            })
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            )
        }

        if (user.isSuspended) {
            await prisma.loginHistory.create({
                data: {
                    userId: user.id,
                    ipAddress,
                    userAgent,
                    success: false,
                },
            })
            await createSystemLog({
                action: 'LOGIN_BLOCKED_SUSPENDED',
                targetType: 'USER',
                targetId: user.id,
                details: `email=${user.email};ip=${ipAddress ?? 'none'}`,
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

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
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

        await createSystemLog({
            actor: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            action: 'LOGIN_SUCCESS',
            targetType: 'USER',
            targetId: user.id,
            details: `ip=${ipAddress ?? 'none'}`,
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
