import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const property = await prisma.property.findFirst({
            where: {
                id,
                isPublished: true,
                status: 'AVAILABLE',
            },
            select: {
                id: true,
                title: true,
                description: true,
                address: true,
                price: true,
                status: true,
                propertyType: true,
                isPremium: true,
                viewsCount: true,
                inquiriesCount: true,
                publishedAt: true,
                createdAt: true,
                images: {
                    select: { id: true, url: true },
                    orderBy: { id: 'asc' },
                },
                manager: {
                    select: { id: true, name: true, email: true },
                },
            },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        await prisma.property.update({
            where: { id: property.id },
            data: { viewsCount: { increment: 1 } },
            select: { id: true },
        })

        return NextResponse.json(property)
    } catch (error) {
        console.error('Marketplace property detail error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
