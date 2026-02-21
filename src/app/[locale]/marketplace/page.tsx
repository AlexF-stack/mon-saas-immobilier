import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Filter, Search } from 'lucide-react'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { rankPropertiesByRecommendedScore, MAX_RECOMMENDED_RERANK_CANDIDATES } from '@/lib/marketplace-ranking'
import { getAppBaseUrl, normalizeCitySlug } from '@/lib/marketplace-seo'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader'
import { MarketplacePropertyCard } from '@/components/marketplace/MarketplacePropertyCard'

type MarketplaceSearchParams = {
    q?: string | string[]
    city?: string | string[]
    location?: string | string[]
    type?: string | string[]
    status?: string | string[]
    minPrice?: string | string[]
    maxPrice?: string | string[]
    sort?: string | string[]
    page?: string | string[]
}

type MarketplaceFilters = {
    query: string
    city: string
    location: string
    type: string
    status: string
    minPriceValue: string
    maxPriceValue: string
    sort: string
    page: number
}

function firstValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? ''
    return value ?? ''
}

function toPositiveInt(value: string, fallback: number) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return fallback
    return parsed
}

function parseFilters(searchParams: MarketplaceSearchParams): MarketplaceFilters {
    return {
        query: firstValue(searchParams.q).trim(),
        city: firstValue(searchParams.city).trim(),
        location: firstValue(searchParams.location).trim(),
        type: firstValue(searchParams.type).toUpperCase(),
        status: firstValue(searchParams.status).toUpperCase() || 'AVAILABLE',
        minPriceValue: firstValue(searchParams.minPrice),
        maxPriceValue: firstValue(searchParams.maxPrice),
        sort: firstValue(searchParams.sort) || 'recommended',
        page: toPositiveInt(firstValue(searchParams.page), 1),
    }
}

function buildQueryParams(filters: MarketplaceFilters, targetPage?: number) {
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (filters.city) params.set('city', filters.city)
    if (filters.location) params.set('location', filters.location)
    if (filters.type) params.set('type', filters.type)
    if (filters.status) params.set('status', filters.status)
    if (filters.minPriceValue) params.set('minPrice', filters.minPriceValue)
    if (filters.maxPriceValue) params.set('maxPrice', filters.maxPriceValue)
    if (filters.sort) params.set('sort', filters.sort)
    if ((targetPage ?? filters.page) > 1) params.set('page', String(targetPage ?? filters.page))
    return params
}

export async function generateMetadata(props: {
    params: Promise<{ locale: string }>
    searchParams: Promise<MarketplaceSearchParams>
}): Promise<Metadata> {
    const { locale } = await props.params
    const filters = parseFilters(await props.searchParams)
    const baseUrl = getAppBaseUrl()
    const basePath = `/${locale}/marketplace`
    const queryParams = buildQueryParams(filters)
    const canonical = queryParams.toString() ? `${basePath}?${queryParams.toString()}` : basePath

    const activeLabels = [
        filters.query ? `Recherche ${filters.query}` : '',
        filters.city ? `Ville ${filters.city}` : '',
        filters.type && filters.type !== 'ALL' ? `Type ${filters.type}` : '',
        filters.status && filters.status !== 'ALL' ? `Statut ${filters.status}` : '',
        filters.page > 1 ? `Page ${filters.page}` : '',
    ].filter(Boolean)

    const title = activeLabels.length
        ? `${activeLabels.join(' - ')} | Marketplace ImmoSaaS`
        : 'Marketplace immobilier | ImmoSaaS'
    const description = activeLabels.length
        ? `Biens disponibles a la location avec filtres actifs: ${activeLabels.join(', ')}.`
        : 'Decouvrez les biens immobiliers disponibles a la location et contactez les proprietaires.'
    const ogParams = new URLSearchParams({
        title,
        subtitle: description,
    })
    const ogImageUrl = `${baseUrl}/api/og/marketplace?${ogParams.toString()}`

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            title,
            description,
            type: 'website',
            locale,
            url: `${baseUrl}${canonical}`,
            images: [
                {
                    url: ogImageUrl,
                    alt: 'ImmoSaaS Marketplace',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
        },
    }
}

export default async function MarketplacePage(props: {
    params: Promise<{ locale: string }>
    searchParams: Promise<MarketplaceSearchParams>
}) {
    const { locale } = await props.params
    const filters = parseFilters(await props.searchParams)

    const pageSize = 9
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null

    const whereClause: Prisma.PropertyWhereInput = {
        isPublished: true,
    }
    const andFilters: Prisma.PropertyWhereInput[] = []

    if (filters.status !== 'ALL') {
        whereClause.status =
            filters.status === 'RENTED' || filters.status === 'MAINTENANCE' ? filters.status : 'AVAILABLE'
    }

    if (filters.query) {
        andFilters.push({
                OR: [
                    { title: { contains: filters.query } },
                    { city: { contains: filters.query } },
                    { address: { contains: filters.query } },
                    { description: { contains: filters.query } },
                ],
            })
        }

        if (filters.city) {
        andFilters.push({ city: { contains: filters.city } })
        }

        if (filters.location) {
            andFilters.push({
                OR: [
                { city: { contains: filters.location } },
                { address: { contains: filters.location } },
                ],
            })
        }

    if (filters.type && ['APARTMENT', 'HOUSE', 'STUDIO', 'COMMERCIAL'].includes(filters.type)) {
        whereClause.propertyType = filters.type
    }

    if (filters.minPriceValue || filters.maxPriceValue) {
        const priceFilter: { gte?: number; lte?: number } = {}
        const minPrice = Number(filters.minPriceValue)
        const maxPrice = Number(filters.maxPriceValue)
        if (Number.isFinite(minPrice) && minPrice > 0) priceFilter.gte = minPrice
        if (Number.isFinite(maxPrice) && maxPrice > 0) priceFilter.lte = maxPrice
        if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
            andFilters.push({ price: priceFilter })
        }
    }

    if (andFilters.length > 0) {
        whereClause.AND = andFilters
    }

    const total = await prisma.property.count({ where: whereClause })
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const clampedPage = Math.min(filters.page, totalPages)
    const pageStart = (clampedPage - 1) * pageSize

    const propertySelect = {
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

    const defaultOrderBy: Prisma.PropertyOrderByWithRelationInput[] = [
        { isPremium: 'desc' },
        { inquiriesCount: 'desc' },
        { viewsCount: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
    ]

    let properties: Array<
        Prisma.PropertyGetPayload<{
            select: typeof propertySelect
        }> & { recommendedScore?: number }
    > = []

    if (filters.sort === 'recommended') {
        const candidateLimit = Math.min(total, MAX_RECOMMENDED_RERANK_CANDIDATES)
        const candidates = await prisma.property.findMany({
            where: whereClause,
            orderBy: defaultOrderBy,
            take: candidateLimit,
            select: propertySelect,
        })

        const ranked = rankPropertiesByRecommendedScore(candidates)
        if (pageStart < ranked.length) {
            properties = ranked.slice(pageStart, pageStart + pageSize)
        } else {
            properties = await prisma.property.findMany({
                where: whereClause,
                orderBy: defaultOrderBy,
                skip: pageStart,
                take: pageSize,
                select: propertySelect,
            })
        }
    } else {
        const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
            filters.sort === 'price-asc'
                ? [{ price: 'asc' }, { createdAt: 'desc' }]
                : filters.sort === 'price-desc'
                    ? [{ price: 'desc' }, { createdAt: 'desc' }]
                    : [{ createdAt: 'desc' }]

        properties = await prisma.property.findMany({
            where: whereClause,
            orderBy,
            skip: pageStart,
            take: pageSize,
            select: propertySelect,
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

    const cityRows = await prisma.property.findMany({
        where: {
            isPublished: true,
            status: 'AVAILABLE',
            city: { not: null },
        },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
        take: 8,
    })
    const cityLinks = cityRows
        .map((row) => row.city?.trim() ?? '')
        .filter(Boolean)
        .map((city) => ({
            city,
            slug: normalizeCitySlug(city),
        }))
        .filter((item) => item.slug.length > 0)

    const basePath = `/${locale}/marketplace`
    const buildPageHref = (targetPage: number) => {
        const nextParams = buildQueryParams(filters, targetPage)
        return `${basePath}?${nextParams.toString()}`
    }
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        url: `${getAppBaseUrl()}${basePath}`,
        name: 'Marketplace immobilier ImmoSaaS',
        numberOfItems: properties.length,
        itemListElement: properties.map((property, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${getAppBaseUrl()}/${locale}/marketplace/${property.id}`,
            name: property.title,
        })),
    }

    return (
        <div className="min-h-screen bg-background text-primary">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <MarketplaceHeader locale={locale} isAuthenticated={Boolean(user)} />

            <main className="container-app space-y-8 py-8">
                <section className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-primary">
                        Marketplace immobilier
                    </h1>
                    <p className="max-w-3xl text-sm text-secondary">
                        Trouvez des biens disponibles, comparez les offres et envoyez une demande de visite en quelques clics.
                    </p>
                </section>

                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <form className="grid grid-cols-1 gap-4 lg:grid-cols-12" method="GET">
                        <div className="space-y-2 lg:col-span-4">
                            <Label htmlFor="q">Recherche</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                                <Input
                                    id="q"
                                    name="q"
                                    defaultValue={filters.query}
                                    placeholder="Titre, quartier, description"
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label htmlFor="city">Ville</Label>
                            <Input
                                id="city"
                                name="city"
                                defaultValue={filters.city}
                                placeholder="Ex: Cotonou"
                            />
                        </div>

                        <div className="space-y-2 lg:col-span-3">
                            <Label htmlFor="location">Localisation</Label>
                            <Input
                                id="location"
                                name="location"
                                defaultValue={filters.location}
                                placeholder="Zone ou adresse"
                            />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label htmlFor="minPrice">Prix min</Label>
                            <Input id="minPrice" name="minPrice" type="number" defaultValue={filters.minPriceValue} />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label htmlFor="maxPrice">Prix max</Label>
                            <Input id="maxPrice" name="maxPrice" type="number" defaultValue={filters.maxPriceValue} />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label>Type</Label>
                            <Select name="type" defaultValue={filters.type || 'ALL'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tous" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tous</SelectItem>
                                    <SelectItem value="APARTMENT">Appartement</SelectItem>
                                    <SelectItem value="HOUSE">Maison</SelectItem>
                                    <SelectItem value="STUDIO">Studio</SelectItem>
                                    <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label>Statut</Label>
                            <Select name="status" defaultValue={filters.status || 'AVAILABLE'}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AVAILABLE">Disponible</SelectItem>
                                    <SelectItem value="ALL">Tous</SelectItem>
                                    <SelectItem value="RENTED">Loue</SelectItem>
                                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <Label>Trier</Label>
                            <Select name="sort" defaultValue={filters.sort}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recommended">Recommandes</SelectItem>
                                    <SelectItem value="latest">Plus recents</SelectItem>
                                    <SelectItem value="price-asc">Prix croissant</SelectItem>
                                    <SelectItem value="price-desc">Prix decroissant</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col items-stretch gap-2 sm:flex-row lg:col-span-2">
                            <Button type="submit" className="w-full sm:flex-1">
                                <Filter className="h-4 w-4" />
                                Filtrer
                            </Button>
                            <Button asChild variant="outline" className="w-full sm:flex-1">
                                <Link href={basePath}>Reinitialiser</Link>
                            </Button>
                        </div>
                    </form>
                </section>

                {cityLinks.length > 0 ? (
                    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                                Explorer par ville
                            </span>
                            {cityLinks.map((item) => (
                                <Button key={item.slug} asChild size="sm" variant="outline">
                                    <Link href={`/${locale}/marketplace/city/${item.slug}`}>{item.city}</Link>
                                </Button>
                            ))}
                        </div>
                    </section>
                ) : null}

                {properties.length === 0 ? (
                    <EmptyState
                        title="Aucun bien trouve"
                        description="Essayez d ajuster vos filtres pour afficher plus d annonces."
                        icon={<Building2 className="h-6 w-6" />}
                        actionLabel="Reinitialiser les filtres"
                        actionHref={basePath}
                    />
                ) : (
                    <>
                        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {properties.map((property) => (
                                <MarketplacePropertyCard key={property.id} locale={locale} property={property} />
                            ))}
                        </section>

                        <nav className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                            {clampedPage <= 1 ? (
                                <Button variant="outline" size="sm" disabled>
                                    Precedent
                                </Button>
                            ) : (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={buildPageHref(Math.max(1, clampedPage - 1))}>Precedent</Link>
                                </Button>
                            )}
                            <span className="px-2 text-sm text-secondary">
                                Page {clampedPage} / {totalPages}
                            </span>
                            {clampedPage >= totalPages ? (
                                <Button variant="outline" size="sm" disabled>
                                    Suivant
                                </Button>
                            ) : (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={buildPageHref(Math.min(totalPages, clampedPage + 1))}>Suivant</Link>
                                </Button>
                            )}
                        </nav>
                    </>
                )}
            </main>
        </div>
    )
}
