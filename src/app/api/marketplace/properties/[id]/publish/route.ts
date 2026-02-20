import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'

const publishSchema = z.object({
    isPublished: z.boolean(),
    isPremium: z.boolean().optional(),
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

        const user = await verifyAuth(token)
        if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { isPublished, isPremium } = publishSchema.parse(await request.json())
        const { id } = await params

        const property = await prisma.property.findUnique({
            where: { id },
            select: { id: true, managerId: true, status: true, isPublished: true, isPremium: true },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        if (user.role === 'MANAGER' && property.managerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (isPublished && property.status !== 'AVAILABLE') {
            return NextResponse.json(
                { error: 'Only available properties can be published.' },
                { status: 409 }
            )
        }

        if (typeof isPremium === 'boolean' && user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Only admin can update premium status.' },
                { status: 403 }
            )
        }

        const updated = await prisma.property.update({
            where: { id },
            data: {
                isPublished,
                publishedAt: isPublished ? new Date() : null,
                ...(typeof isPremium === 'boolean' ? { isPremium } : {}),
            },
            select: {
                id: true,
                title: true,
                status: true,
                isPublished: true,
                isPremium: true,
                publishedAt: true,
            },
        })

        await createSystemLog({
            actor: user,
            action:
                typeof isPremium === 'boolean'
                    ? isPremium
                        ? 'PROPERTY_PREMIUM_ENABLED'
                        : 'PROPERTY_PREMIUM_DISABLED'
                    : isPublished
                        ? 'PROPERTY_PUBLISHED'
                        : 'PROPERTY_UNPUBLISHED',
            targetType: 'PROPERTY',
            targetId: updated.id,
            details: `status=${updated.status};published=${updated.isPublished};premium=${updated.isPremium}`,
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Publish marketplace property error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
