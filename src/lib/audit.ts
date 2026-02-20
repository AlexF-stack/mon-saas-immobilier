import { prisma } from '@/lib/prisma'
import type { AuthTokenPayload } from '@/lib/auth'

type SystemLogPayload = {
    actor?: Pick<AuthTokenPayload, 'id' | 'email' | 'role'> | null
    action: string
    targetType: string
    targetId?: string
    details?: string
}

export async function createSystemLog(payload: SystemLogPayload) {
    try {
        await prisma.systemLog.create({
            data: {
                actorId: payload.actor?.id ?? null,
                actorEmail: payload.actor?.email ?? null,
                actorRole: payload.actor?.role ?? null,
                action: payload.action,
                targetType: payload.targetType,
                targetId: payload.targetId ?? null,
                details: payload.details ?? null,
            },
        })
    } catch (error) {
        console.error('Failed to persist system log', error)
    }
}
