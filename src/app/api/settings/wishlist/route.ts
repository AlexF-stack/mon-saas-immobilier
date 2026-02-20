import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const wishlistMutationSchema = z
    .object({
        propertyId: z.string().trim().cuid(),
    })
    .strict()

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (user.role !== 'TENANT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const wishlist = await prisma.wishlistItem.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                property: {
                    select: {
                        id: true,
                        title: true,
                        city: true,
                        address: true,
                        price: true,
                        status: true,
                        isPublished: true,
                    },
                },
            },
        })

        return NextResponse.json(
            wishlist
                .filter((item) => item.property.isPublished)
                .map((item) => ({
                    id: item.id,
                    propertyId: item.propertyId,
                    createdAt: item.createdAt,
                    property: item.property,
                }))
        )
    } catch (error) {
        console.error('Wishlist fetch error', error)
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
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (user.role !== 'TENANT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const payload = wishlistMutationSchema.parse(await request.json())
        const property = await prisma.property.findFirst({
            where: {
                id: payload.propertyId,
                isPublished: true,
                status: 'AVAILABLE',
            },
            select: { id: true },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        const item = await prisma.wishlistItem.upsert({
            where: {
                userId_propertyId: {
                    userId: user.id,
                    propertyId: payload.propertyId,
                },
            },
            update: {},
            create: {
                userId: user.id,
                propertyId: payload.propertyId,
            },
            select: {
                id: true,
                propertyId: true,
                createdAt: true,
            },
        })

        await createSystemLog({
            actor: user,
            action: 'TENANT_WISHLIST_ADDED',
            targetType: 'PROPERTY',
            targetId: payload.propertyId,
        })

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Wishlist add error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (user.role !== 'TENANT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const payload = wishlistMutationSchema.parse(await request.json())
        await prisma.wishlistItem.deleteMany({
            where: {
                userId: user.id,
                propertyId: payload.propertyId,
            },
        })

        await createSystemLog({
            actor: user,
            action: 'TENANT_WISHLIST_REMOVED',
            targetType: 'PROPERTY',
            targetId: payload.propertyId,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Wishlist remove error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
