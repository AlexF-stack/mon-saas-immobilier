import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest, isUserRole } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateRoleSchema = z.object({
    role: z.string().trim().min(1),
})

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const actor = await verifyAuth(token)
        if (!actor || actor.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id: targetUserId } = await params
        const body = await request.json()
        const parsed = updateRoleSchema.parse(body)
        const newRole = parsed.role

        if (!isUserRole(newRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const target = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, email: true, role: true, isSuspended: true },
        })

        if (!target) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (!isUserRole(target.role)) {
            return NextResponse.json({ error: 'Target role is invalid' }, { status: 500 })
        }

        if (actor.id === target.id && newRole !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Self role downgrade is not allowed' },
                { status: 400 }
            )
        }

        if (target.role === 'ADMIN' && newRole !== 'ADMIN' && !target.isSuspended) {
            const activeAdminCount = await prisma.user.count({
                where: { role: 'ADMIN', isSuspended: false },
            })

            if (activeAdminCount <= 1) {
                return NextResponse.json(
                    { error: 'Cannot downgrade the last active admin' },
                    { status: 400 }
                )
            }
        }

        const updated = await prisma.user.update({
            where: { id: target.id },
            data: { role: newRole },
            select: {
                id: true,
                email: true,
                role: true,
                isSuspended: true,
                updatedAt: true,
            },
        })

        await createSystemLog({
            actor,
            action: 'USER_ROLE_CHANGED',
            targetType: 'USER',
            targetId: updated.id,
            details: `from=${target.role};to=${updated.role}`,
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Role update error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
