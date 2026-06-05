import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { getCorrelationIdFromRequest } from '@/lib/correlation-id'
import { captureServerError } from '@/lib/monitoring'
import { normalizePropertyOfferType } from '@/lib/property-offer'
import {
    normalizePropertyDocumentType,
    persistUploadedFile,
} from '@/lib/property-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_PROPERTY_IMAGES = 3
const MIN_LAND_DOCUMENTS = 1

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

function getOptionalFormString(
    formData: FormData,
    key: string
): string | undefined {
    const value = formData.get(key)
    return typeof value === 'string' ? value : undefined
}

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
        const correlationId = getCorrelationIdFromRequest(request)
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
        const title = getOptionalFormString(formData, 'title')
        const city = getOptionalFormString(formData, 'city')
        const address = getOptionalFormString(formData, 'address')
        const price = getOptionalFormString(formData, 'price')
        const description = getOptionalFormString(formData, 'description')
        const propertyType = getOptionalFormString(formData, 'propertyType')
        const offerType = getOptionalFormString(formData, 'offerType')
        const isPublished = getOptionalFormString(formData, 'isPublished')
        const status = getOptionalFormString(formData, 'status')
        const legacyImage = formData.get('image') as File | null
        const images = formData
            .getAll('images')
            .filter((value): value is File => value instanceof File && value.size > 0)
        const landDocuments = formData
            .getAll('landDocuments')
            .filter((value): value is File => value instanceof File && value.size > 0)
        const defaultLandDocumentType = normalizePropertyDocumentType(
            getOptionalFormString(formData, 'landDocumentType')
        )
        const imageUrlsRaw = getOptionalFormString(formData, 'imageUrls') ?? ''
        const imageUrls = imageUrlsRaw
            ? imageUrlsRaw
                  .split(/\r?\n|,/)
                  .map((value) => value.trim())
                  .filter(Boolean)
            : []

        const data = {
            title: title ?? undefined,
            city: city ?? undefined,
            address: address ?? undefined,
            price: price ?? undefined,
            description: description ?? undefined,
            propertyType: propertyType ?? undefined,
            offerType: offerType ?? undefined,
            status: status ?? undefined,
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

        const requiresLandDocuments = normalizedOfferType === 'SALE'
        const uploadedImages = images.length > 0 ? images : legacyImage && legacyImage.size > 0 ? [legacyImage] : []
        const uploadedImageUrls: string[] = []
        for (const image of uploadedImages) {
            const stored = await persistUploadedFile(image, { kind: 'image' })
            if ('error' in stored) {
                return NextResponse.json({ error: stored.error }, { status: stored.status })
            }
            uploadedImageUrls.push(stored.url)
        }

        const uploadedLandDocuments: Array<{
            title: string
            documentType: string
            url: string
            mimeType: string
            fileSize: number
        }> = []
        for (const doc of requiresLandDocuments ? landDocuments : []) {
            const stored = await persistUploadedFile(doc, { kind: 'document' })
            if ('error' in stored) {
                return NextResponse.json({ error: stored.error }, { status: stored.status })
            }
            uploadedLandDocuments.push({
                title: doc.name.replace(/\.[^.]+$/, '') || 'Document foncier',
                documentType: defaultLandDocumentType,
                url: stored.url,
                mimeType: stored.mimeType,
                fileSize: stored.fileSize,
            })
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
        const allImageUrls = [...uploadedImageUrls, ...(parsed.imageUrls ?? [])]
        if (allImageUrls.length < MIN_PROPERTY_IMAGES) {
            return NextResponse.json(
                { error: `Au moins ${MIN_PROPERTY_IMAGES} images sont requises.` },
                { status: 400 }
            )
        }

        if (requiresLandDocuments && uploadedLandDocuments.length < MIN_LAND_DOCUMENTS) {
            return NextResponse.json(
                { error: `Au moins ${MIN_LAND_DOCUMENTS} document foncier est requis.` },
                { status: 400 }
            )
        }

        const property = await prisma.$transaction(async (tx) => {
            const created = await tx.property.create({
                data: propertyInfo,
            })

            if (allImageUrls.length > 0) {
                for (const url of allImageUrls) {
                    await tx.propertyImage.create({
                        data: {
                            url,
                            propertyId: created.id,
                        },
                    })
                }
            }

            if (uploadedLandDocuments.length > 0) {
                for (const doc of uploadedLandDocuments) {
                    await tx.propertyDocument.create({
                        data: {
                            ...doc,
                            propertyId: created.id,
                        },
                    })
                }
            }

            return created
        })

        await createSystemLog({
            actor: user,
            action: 'PROPERTY_CREATED',
            targetType: 'PROPERTY',
            targetId: property.id,
            correlationId,
            route: '/api/properties',
            details: `title=${property.title};managerId=${property.managerId ?? 'none'};status=${property.status};published=${property.isPublished};type=${property.propertyType};imageCount=${allImageUrls.length};landDocCount=${uploadedLandDocuments.length}`,
        })

        return NextResponse.json(property, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }

        await captureServerError(error, {
            scope: 'properties_create',
            targetType: 'PROPERTY',
            correlationId: getCorrelationIdFromRequest(request),
            route: '/api/properties',
        })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
