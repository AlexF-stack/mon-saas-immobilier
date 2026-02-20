import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { comparePassword, getTokenFromRequest, hashPassword, verifyAuth } from '@/lib/auth'
import { validatePasswordComplexity } from '@/lib/auth-policy'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

const passwordUpdateSchema = z
    .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
        confirmPassword: z.string().min(8),
    })
    .refine((payload) => payload.newPassword === payload.confirmPassword, {
        message: 'Password confirmation does not match.',
        path: ['confirmPassword'],
    })

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = passwordUpdateSchema.parse(await request.json())

        if (!validatePasswordComplexity(payload.newPassword)) {
            return NextResponse.json(
                {
                    error:
                        'Password must contain upper/lower case letters, a number, a special character and be at least 8 characters long',
                },
                { status: 400 }
            )
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, password: true },
        })

        if (!currentUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        const isCurrentPasswordValid = await comparePassword(payload.currentPassword, currentUser.password)
        if (!isCurrentPasswordValid) {
            await createSystemLog({
                actor: user,
                action: 'USER_PASSWORD_CHANGE_REJECTED',
                targetType: 'USER',
                targetId: user.id,
                details: 'reason=invalid_current_password',
            })
            return NextResponse.json({ error: 'Current password is invalid.' }, { status: 400 })
        }

        const isSamePassword = await comparePassword(payload.newPassword, currentUser.password)
        if (isSamePassword) {
            return NextResponse.json(
                { error: 'New password must be different from current password.' },
                { status: 400 }
            )
        }

        const nextHash = await hashPassword(payload.newPassword)
        await prisma.user.update({
            where: { id: user.id },
            data: { password: nextHash },
            select: { id: true },
        })

        await createSystemLog({
            actor: user,
            action: 'USER_PASSWORD_CHANGED',
            targetType: 'USER',
            targetId: user.id,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Settings password update error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
