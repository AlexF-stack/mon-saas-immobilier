import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

const createPropertySchema = z.object({
    title: z.string().trim().min(2).max(150),
    city: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
        z.string().trim().min(2).max(120).optional()
    ),
    address: z.string().trim().min(5).max(255),
    price: z.coerce.number().positive(),
    description: z.string().trim().max(2000).optional(),
    status: z.string().optional(),
    propertyType: z.string().optional(),
    isPublished: z.coerce.boolean().optional(),
})

function normalizeCreationStatus(input?: string): 'AVAILABLE' | 'RENTED' | null {
    if (!input) return 'AVAILABLE'

    const normalized = input
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (normalized === 'AVAILABLE' || normalized === 'DISPONIBLE') return 'AVAILABLE'
    if (normalized === 'RENTED' || normalized === 'OCCUPIED' || normalized === 'OCCUPE') return 'RENTED'
    return null
}

function normalizePropertyType(input?: string): 'APARTMENT' | 'HOUSE' | 'STUDIO' | 'COMMERCIAL' | null {
    if (!input) return 'APARTMENT'

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

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (user.role === 'TENANT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const whereClause = user.role === 'ADMIN' ? {} : { managerId: user.id }
        const properties = await prisma.property.findMany({
            where: whereClause,
            include: { contracts: true },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json(properties)
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
        // PROPRIETAIRE = role interne MANAGER
        if (!user || user.role !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })
        }

        const body = await request.json()
        const parsed = createPropertySchema.parse(body)
        const normalizedStatus = normalizeCreationStatus(parsed.status)
        const normalizedPropertyType = normalizePropertyType(parsed.propertyType)

        if (!normalizedStatus) {
            return NextResponse.json(
                { error: 'Invalid status. Use DISPONIBLE or OCCUPE.' },
                { status: 400 }
            )
        }

        if (!normalizedPropertyType) {
            return NextResponse.json(
                { error: 'Invalid propertyType. Use APARTMENT, HOUSE, STUDIO or COMMERCIAL.' },
                { status: 400 }
            )
        }

        if (parsed.isPublished === true && normalizedStatus !== 'AVAILABLE') {
            return NextResponse.json(
                { error: 'Only available properties can be published.' },
                { status: 409 }
            )
        }

        const property = await prisma.property.create({
            data: {
                title: parsed.title,
                city: parsed.city,
                address: parsed.address,
                price: parsed.price,
                description: parsed.description,
                propertyType: normalizedPropertyType,
                status: normalizedStatus,
                isPublished: parsed.isPublished === true,
                publishedAt: parsed.isPublished === true ? new Date() : null,
                managerId: user.id,
            },
        })

        await createSystemLog({
            actor: user,
            action: 'PROPERTY_CREATED',
            targetType: 'PROPERTY',
            targetId: property.id,
            details: `title=${property.title};managerId=${property.managerId ?? 'none'};status=${property.status};published=${property.isPublished};type=${property.propertyType}`,
        })

        return NextResponse.json(property, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error(error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
