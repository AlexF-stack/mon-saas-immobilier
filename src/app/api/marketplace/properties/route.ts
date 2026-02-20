import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { rankPropertiesByRecommendedScore, MAX_RECOMMENDED_RERANK_CANDIDATES } from '@/lib/marketplace-ranking'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = new Set(['AVAILABLE', 'RENTED', 'MAINTENANCE'])
const VALID_TYPES = new Set(['APARTMENT', 'HOUSE', 'STUDIO', 'COMMERCIAL'])

function parsePositiveInt(value: string | null, fallback: number) {
    if (!value) return fallback
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return fallback
    return parsed
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const search = url.searchParams.get('q')?.trim() ?? ''
        const city = url.searchParams.get('city')?.trim() ?? ''
        const location = url.searchParams.get('location')?.trim() ?? ''
        const type = (url.searchParams.get('type') ?? '').toUpperCase()
        const statusParam = (url.searchParams.get('status') ?? 'AVAILABLE').toUpperCase()
        const minPrice = url.searchParams.get('minPrice')
        const maxPrice = url.searchParams.get('maxPrice')
        const sort = (url.searchParams.get('sort') ?? 'recommended').toLowerCase()

        const page = parsePositiveInt(url.searchParams.get('page'), 1)
        const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 12), 24)

        const whereClause: Prisma.PropertyWhereInput = {
            isPublished: true,
        }
        const andFilters: Prisma.PropertyWhereInput[] = []

        if (statusParam !== 'ALL') {
            whereClause.status = VALID_STATUSES.has(statusParam) ? statusParam : 'AVAILABLE'
        }

        if (search) {
            andFilters.push({
                OR: [
                    { title: { contains: search } },
                    { city: { contains: search } },
                    { address: { contains: search } },
                    { description: { contains: search } },
                ],
            })
        }

        if (city) {
            andFilters.push({ city: { contains: city } })
        }

        if (location) {
            andFilters.push({
                OR: [
                    { city: { contains: location } },
                    { address: { contains: location } },
                ],
            })
        }

        if (type && VALID_TYPES.has(type)) {
            whereClause.propertyType = type
        }

        if (minPrice || maxPrice) {
            const priceFilter: { gte?: number; lte?: number } = {}
            if (minPrice) {
                const parsedMin = Number(minPrice)
                if (Number.isFinite(parsedMin) && parsedMin > 0) priceFilter.gte = parsedMin
            }
            if (maxPrice) {
                const parsedMax = Number(maxPrice)
                if (Number.isFinite(parsedMax) && parsedMax > 0) priceFilter.lte = parsedMax
            }
            if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
                andFilters.push({ price: priceFilter })
            }
        }

        if (andFilters.length > 0) {
            whereClause.AND = andFilters
        }

        const select = {
            id: true,
            title: true,
            city: true,
            address: true,
            description: true,
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
                take: 1,
                orderBy: { id: 'asc' as const },
            },
        } satisfies Prisma.PropertySelect

        const total = await prisma.property.count({ where: whereClause })
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const clampedPage = Math.min(page, totalPages)
        const clampedSkip = (clampedPage - 1) * pageSize

        const defaultRecommendedOrderBy: Prisma.PropertyOrderByWithRelationInput[] = [
            { isPremium: 'desc' },
            { inquiriesCount: 'desc' },
            { viewsCount: 'desc' },
            { publishedAt: 'desc' },
            { createdAt: 'desc' },
        ]

        let properties: Array<
            Prisma.PropertyGetPayload<{
                select: typeof select
            }> & { recommendedScore?: number }
        > = []

        if (sort === 'recommended') {
            const candidateLimit = Math.min(total, MAX_RECOMMENDED_RERANK_CANDIDATES)
            const candidates = await prisma.property.findMany({
                where: whereClause,
                orderBy: defaultRecommendedOrderBy,
                take: candidateLimit,
                select,
            })

            const ranked = rankPropertiesByRecommendedScore(candidates)
            if (clampedSkip < ranked.length) {
                properties = ranked.slice(clampedSkip, clampedSkip + pageSize)
            } else {
                properties = await prisma.property.findMany({
                    where: whereClause,
                    orderBy: defaultRecommendedOrderBy,
                    skip: clampedSkip,
                    take: pageSize,
                    select,
                })
            }
        } else {
            const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
                sort === 'price-asc'
                    ? [{ price: 'asc' }, { createdAt: 'desc' }]
                    : sort === 'price-desc'
                        ? [{ price: 'desc' }, { createdAt: 'desc' }]
                        : [{ createdAt: 'desc' }]

            properties = await prisma.property.findMany({
                where: whereClause,
                orderBy,
                skip: clampedSkip,
                take: pageSize,
                select,
            })
        }

        if (properties.length > 0) {
            await prisma.$transaction(
                properties.map((property) =>
                    prisma.property.update({
                        where: { id: property.id },
                        data: { impressionsCount: { increment: 1 } },
                        select: { id: true },
                    })
                )
            )
        }

        return NextResponse.json({
            data: properties,
            pagination: {
                page: clampedPage,
                pageSize,
                total,
                totalPages,
            },
        })
    } catch (error) {
        console.error('Marketplace properties list error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
