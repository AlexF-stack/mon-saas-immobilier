import { prisma } from '@/lib/prisma'
import type { AuthTokenPayload } from '@/lib/auth'

type SystemLogPayload = {
    actor?: Pick<AuthTokenPayload, 'id' | 'email' | 'role'> | null
    action: string
    targetType: string
    targetId?: string
    details?: string
    correlationId?: string
    route?: string
}

export async function createSystemLog(payload: SystemLogPayload) {
    try {
        const detailParts = [
            payload.correlationId ? `correlationId=${payload.correlationId}` : null,
            payload.route ? `route=${payload.route}` : null,
            payload.details ?? null,
        ].filter((part): part is string => Boolean(part))

        await prisma.systemLog.create({
            data: {
                actorId: payload.actor?.id ?? null,
                actorEmail: payload.actor?.email ?? null,
                actorRole: payload.actor?.role ?? null,
                action: payload.action,
                targetType: payload.targetType,
                targetId: payload.targetId ?? null,
                details: detailParts.length > 0 ? detailParts.join(';').slice(0, 1900) : null,
            },
        })
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to persist system log', error)
        }
    }
}
