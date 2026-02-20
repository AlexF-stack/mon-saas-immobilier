import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest, hashPassword } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

const createTenantSchema = z.object({
    email: z.string().trim().email(),
    name: z.string().trim().min(2).max(120),
    password: z.string().trim().min(8).optional(),
})

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let whereClause: Record<string, unknown>

        if (user.role === 'ADMIN') {
            whereClause = { role: 'TENANT' }
        } else if (user.role === 'MANAGER') {
            whereClause = {
                role: 'TENANT',
                contracts: {
                    some: {
                        property: { managerId: user.id },
                    },
                },
            }
        } else {
            whereClause = { id: user.id, role: 'TENANT' }
        }

        const tenants = await prisma.user.findMany({
            where: whereClause,
            select: { id: true, name: true, email: true, createdAt: true, isSuspended: true },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json(tenants)
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const parsed = createTenantSchema.parse(body)
        const email = parsed.email.toLowerCase()

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
        if (existing) {
            return NextResponse.json({ error: 'Email already used' }, { status: 409 })
        }

        const generatedPassword = randomBytes(9).toString('base64url')
        const finalPassword = parsed.password ?? generatedPassword
        const hashedPassword = await hashPassword(finalPassword)

        const tenant = await prisma.user.create({
            data: {
                email,
                name: parsed.name,
                password: hashedPassword,
                role: 'TENANT',
            },
        })

        await createSystemLog({
            actor: user,
            action: 'TENANT_CREATED',
            targetType: 'USER',
            targetId: tenant.id,
            details: `email=${tenant.email}`,
        })

        const { password: removedPassword, ...tenantWithoutPassword } = tenant
        void removedPassword

        return NextResponse.json(
            {
                tenant: tenantWithoutPassword,
                generatedPassword: parsed.password ? null : generatedPassword,
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
