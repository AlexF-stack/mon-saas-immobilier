import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const patchPropertySchema = z.object({
    title: z.string().trim().min(2).max(150).optional(),
    city: z.preprocess(
        (value) => {
            if (value === null) return null
            if (typeof value === 'string' && value.trim() === '') return null
            return value
        },
        z.string().trim().min(2).max(120).nullable().optional()
    ),
    address: z.string().trim().min(5).max(255).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    price: z.coerce.number().positive().optional(),
    status: z.string().optional(),
    propertyType: z.string().optional(),
    isPublished: z.coerce.boolean().optional(),
    managerId: z.string().trim().nullable().optional(),
})

function normalizeStatus(input?: string): 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | null {
    if (!input) return null

    const normalized = input
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (normalized === 'AVAILABLE' || normalized === 'DISPONIBLE') return 'AVAILABLE'
    if (normalized === 'RENTED' || normalized === 'OCCUPIED' || normalized === 'OCCUPE') return 'RENTED'
    if (normalized === 'MAINTENANCE') return 'MAINTENANCE'
    return null
}

function normalizePropertyType(input?: string): 'APARTMENT' | 'HOUSE' | 'STUDIO' | 'COMMERCIAL' | null {
    if (!input) return null

    const normalized = input
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (normalized === 'APARTMENT' || normalized === 'APPARTEMENT') return 'APARTMENT'
    if (normalized === 'HOUSE' || normalized === 'MAISON') return 'HOUSE'
    if (normalized === 'STUDIO') return 'STUDIO'
    if (normalized === 'COMMERCIAL' || normalized === 'COMMERCE') return 'COMMERCIAL'
    return null
}

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

        const { id } = await params
        const property = await prisma.property.findUnique({
            where: { id },
            select: { id: true, managerId: true, status: true, isPublished: true },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        if (!canManageProperty(user, property.managerId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const parsed = patchPropertySchema.parse(body)
        const data: {
            title?: string
            city?: string | null
            address?: string
            description?: string | null
            price?: number
            propertyType?: 'APARTMENT' | 'HOUSE' | 'STUDIO' | 'COMMERCIAL'
            status?: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE'
            isPublished?: boolean
            publishedAt?: Date | null
            managerId?: string | null
        } = {}

        if (typeof parsed.title === 'string') data.title = parsed.title
        if (typeof parsed.city !== 'undefined') data.city = parsed.city
        if (typeof parsed.address === 'string') data.address = parsed.address
        if (typeof parsed.description !== 'undefined') data.description = parsed.description
        if (typeof parsed.price === 'number') data.price = parsed.price

        if (typeof parsed.status === 'string') {
            const normalizedStatus = normalizeStatus(parsed.status)
            if (!normalizedStatus) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
            }
            data.status = normalizedStatus
        }

        if (typeof parsed.propertyType === 'string') {
            const normalizedPropertyType = normalizePropertyType(parsed.propertyType)
            if (!normalizedPropertyType) {
                return NextResponse.json({ error: 'Invalid propertyType' }, { status: 400 })
            }
            data.propertyType = normalizedPropertyType
        }

        if (typeof parsed.isPublished === 'boolean') {
            data.isPublished = parsed.isPublished
            data.publishedAt = parsed.isPublished ? new Date() : null
        }

        const nextStatus = data.status ?? property.status
        const nextPublished = data.isPublished ?? property.isPublished
        if (nextPublished && nextStatus !== 'AVAILABLE') {
            return NextResponse.json(
                { error: 'Only available properties can be published' },
                { status: 409 }
            )
        }

        if (data.status && data.status !== 'AVAILABLE') {
            data.isPublished = false
            data.publishedAt = null
        }

        if (typeof parsed.managerId !== 'undefined') {
            if (user.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Only admins can reassign manager' }, { status: 403 })
            }

            const requestedManagerId = parsed.managerId?.trim() || null
            if (!requestedManagerId) {
                data.managerId = null
            } else {
                const manager = await prisma.user.findUnique({
                    where: { id: requestedManagerId },
                    select: { id: true, role: true },
                })

                if (!manager || (manager.role !== 'ADMIN' && manager.role !== 'MANAGER')) {
                    return NextResponse.json({ error: 'Invalid managerId' }, { status: 400 })
                }

                data.managerId = manager.id
            }
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        const updated = await prisma.property.update({
            where: { id },
            data,
        })

        await createSystemLog({
            actor: user,
            action: 'PROPERTY_UPDATED',
            targetType: 'PROPERTY',
            targetId: updated.id,
            details: `fields=${Object.keys(data).join(',')};published=${updated.isPublished};status=${updated.status}`,
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Property update error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(
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

        const { id } = await params
        const property = await prisma.property.findUnique({
            where: { id },
            select: { id: true, managerId: true },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        if (!canManageProperty(user, property.managerId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await prisma.property.delete({ where: { id } })

        await createSystemLog({
            actor: user,
            action: 'PROPERTY_DELETED',
            targetType: 'PROPERTY',
            targetId: id,
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Property delete error', error)
        return NextResponse.json({ error: 'Cannot delete property with linked contracts' }, { status: 409 })
    }
}
