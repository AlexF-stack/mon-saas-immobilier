import { NextResponse } from 'next/server'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { normalizePropertyOfferType } from '@/lib/property-offer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])


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
    offerType: z.string().optional(),
    isPublished: z.coerce.boolean().optional(),
    imageUrls: z.array(z.string().trim().min(5)).optional(),
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

function normalizePropertyType(input?: string): 'APARTMENT' | 'HOUSE' | 'STUDIO' | 'COMMERCIAL' | 'LAND' | null {
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
    if (normalized === 'LAND' || normalized === 'TERRAIN') return 'LAND'
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

        const url = new URL(request.url)
        const statusQuery = url.searchParams.get('status')?.trim().toUpperCase()
        const offerTypeQuery = normalizePropertyOfferType(url.searchParams.get('offerType'))

        const whereClause: {
            managerId?: string
            status?: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE'
            offerType?: 'RENT' | 'SALE'
        } = user.role === 'ADMIN' ? {} : { managerId: user.id }

        if (statusQuery === 'AVAILABLE' || statusQuery === 'RENTED' || statusQuery === 'MAINTENANCE') {
            whereClause.status = statusQuery
        }
        if (offerTypeQuery) {
            whereClause.offerType = offerTypeQuery
        }

        const properties = await prisma.property.findMany({
            where: whereClause,
            select: {
                id: true,
                title: true,
                city: true,
                address: true,
                price: true,
                description: true,
                status: true,
                propertyType: true,
                offerType: true,
                isPublished: true,
                isPremium: true,
                viewsCount: true,
                impressionsCount: true,
                inquiriesCount: true,
                createdAt: true,
                publishedAt: true,
                managerId: true,
            },
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

        const formData = await request.formData()
        const title = formData.get('title')
        const city = formData.get('city')
        const address = formData.get('address')
        const price = formData.get('price')
        const description = formData.get('description')
        const propertyType = formData.get('propertyType')
        const offerType = formData.get('offerType')
        const isPublished = formData.get('isPublished')
        const status = formData.get('status')
        const image = formData.get('image') as File | null
        const imageUrlsRaw = typeof formData.get('imageUrls') === 'string' ? String(formData.get('imageUrls')) : ''
        const imageUrls = imageUrlsRaw
            ? imageUrlsRaw
                  .split(/\r?\n|,/)
                  .map((value) => value.trim())
                  .filter(Boolean)
            : []

        const data = {
            title,
            city,
            address,
            price,
            description,
            propertyType,
            offerType,
            status,
            isPublished: isPublished === 'true',
            imageUrls,
        }

        const parsed = createPropertySchema.parse(data)
        const normalizedStatus = normalizeCreationStatus(parsed.status as string | undefined)
        const normalizedPropertyType = normalizePropertyType(parsed.propertyType as string | undefined)
        const normalizedOfferType = normalizePropertyOfferType(parsed.offerType as string | undefined, 'RENT')

        if (!normalizedStatus) {
            return NextResponse.json(
                { error: 'Invalid status. Use DISPONIBLE or OCCUPE.' },
                { status: 400 }
            )
        }

        if (!normalizedPropertyType) {
            return NextResponse.json(
                { error: 'Invalid propertyType. Use APARTMENT, HOUSE, STUDIO, COMMERCIAL or LAND.' },
                { status: 400 }
            )
        }

        if (!normalizedOfferType) {
            return NextResponse.json(
                { error: 'Invalid offerType. Use RENT or SALE.' },
                { status: 400 }
            )
        }

        if (normalizedOfferType === 'SALE' && normalizedStatus === 'RENTED') {
            return NextResponse.json(
                { error: 'Sale property cannot be created as rented.' },
                { status: 409 }
            )
        }

        if (parsed.isPublished === true && normalizedStatus !== 'AVAILABLE') {
            return NextResponse.json(
                { error: 'Only available properties can be published.' },
                { status: 409 }
            )
        }

        let imageUrl: string | null = null
        if (image && image.size > 0) {
            if (image.size > MAX_IMAGE_SIZE_BYTES) {
                return NextResponse.json(
                    { error: 'Image too large. Max size is 2MB.' },
                    { status: 413 }
                )
            }

            if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
                return NextResponse.json(
                    { error: 'Unsupported image format. Use JPG, PNG or WEBP.' },
                    { status: 400 }
                )
            }

            const buffer = Buffer.from(await image.arrayBuffer())
            const base64 = buffer.toString('base64')
            const dataUri = `data:${image.type};base64,${base64}`

            if (process.env.VERCEL === '1') {
                // Vercel serverless runtime cannot persist files under public/.
                imageUrl = dataUri
            } else {
                try {
                    // Local/dev fallback: store to public/uploads.
                    const uploadsDir = join(process.cwd(), 'public', 'uploads')
                    try {
                        mkdirSync(uploadsDir, { recursive: true })
                    } catch {}

                    const filename = `${Date.now()}-${image.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                    const filepath = join(uploadsDir, filename)
                    writeFileSync(filepath, buffer)
                    imageUrl = `/uploads/${filename}`
                } catch {
                    // If local file save fails, still persist image via data URI to avoid blocking creation.
                    imageUrl = dataUri
                }
            }
        }

        const propertyInfo = {
            title: parsed.title,
            city: parsed.city,
            address: parsed.address,
            price: parsed.price,
            description: parsed.description,
            propertyType: normalizedPropertyType,
            offerType: normalizedOfferType,
            status: normalizedStatus,
            isPublished: parsed.isPublished === true,
            publishedAt: parsed.isPublished === true ? new Date() : null,
            managerId: user.id,
        }
        const allImageUrls = [...(parsed.imageUrls ?? [])]
        if (imageUrl) {
            allImageUrls.unshift(imageUrl)
        }

        const property = await prisma.$transaction(async (tx) => {
            const created = await tx.property.create({
                data: propertyInfo,
            })

            if (allImageUrls.length > 0) {
                await tx.propertyImage.createMany({
                    data: allImageUrls.map((url) => ({
                        url,
                        propertyId: created.id,
                    })),
                })
            }

            return created
        })

        await createSystemLog({
            actor: user,
            action: 'PROPERTY_CREATED',
            targetType: 'PROPERTY',
            targetId: property.id,
            details: `title=${property.title};managerId=${property.managerId ?? 'none'};status=${property.status};published=${property.isPublished};type=${property.propertyType};imageCount=${allImageUrls.length}`,
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
