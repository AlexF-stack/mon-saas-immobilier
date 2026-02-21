import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { getAppBaseUrl, normalizeCitySlug } from '@/lib/marketplace-seo'
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader'
import { MarketplacePropertyCard } from '@/components/marketplace/MarketplacePropertyCard'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

type CityPageSearchParams = {
    page?: string | string[]
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

async function findCityFromSlug(citySlug: string) {
    const rows = await prisma.property.findMany({
        where: {
            isPublished: true,
            status: 'AVAILABLE',
            city: { not: null },
        },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
    })

    const match = rows.find((row) => {
        const value = row.city?.trim()
        return value ? normalizeCitySlug(value) === citySlug : false
    })

    return match?.city?.trim() ?? null
}

export async function generateMetadata(props: {
    params: Promise<{ locale: string; citySlug: string }>
}): Promise<Metadata> {
    const { locale, citySlug } = await props.params
    const city = await findCityFromSlug(citySlug)

    if (!city) {
        return {
            title: 'Ville introuvable | Marketplace ImmoSaaS',
            description: 'Aucune annonce disponible pour cette ville.',
        }
    }

    const baseUrl = getAppBaseUrl()
    const canonicalPath = `/${locale}/marketplace/city/${citySlug}`
    const title = `Location immobiliere a ${city} | Marketplace ImmoSaaS`
    const description = `Consultez les biens disponibles a ${city}, comparez les loyers et envoyez une demande de visite.`
    const ogImage = `${baseUrl}/api/og/marketplace?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`

    return {
        title,
        description,
        alternates: { canonical: canonicalPath },
        openGraph: {
            title,
            description,
            type: 'website',
            locale,
            url: `${baseUrl}${canonicalPath}`,
            images: [{ url: ogImage, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
    }
}

export default async function MarketplaceCityPage(props: {
    params: Promise<{ locale: string; citySlug: string }>
    searchParams: Promise<CityPageSearchParams>
}) {
    const { locale, citySlug } = await props.params
    const city = await findCityFromSlug(citySlug)
    if (!city) notFound()

    const filters = await props.searchParams
    const page = toPositiveInt(firstValue(filters.page), 1)
    const pageSize = 12

    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null

    const total = await prisma.property.count({
        where: {
            isPublished: true,
            status: 'AVAILABLE',
            city,
        },
    })
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const clampedPage = Math.min(page, totalPages)

    const properties = await prisma.property.findMany({
        where: {
            isPublished: true,
            status: 'AVAILABLE',
            city,
        },
        orderBy: [{ isPremium: 'desc' }, { inquiriesCount: 'desc' }, { viewsCount: 'desc' }, { createdAt: 'desc' }],
        skip: (clampedPage - 1) * pageSize,
        take: pageSize,
        select: {
            id: true,
            title: true,
            city: true,
            address: true,
            description: true,
            price: true,
            status: true,
            propertyType: true,
            isPremium: true,
            images: {
                select: { id: true, url: true },
                take: 1,
                orderBy: { id: 'asc' },
            },
        },
    })

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

    const canonicalUrl = `${getAppBaseUrl()}/${locale}/marketplace/city/${citySlug}`
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        url: canonicalUrl,
        name: `Locations disponibles a ${city}`,
        numberOfItems: properties.length,
        itemListElement: properties.map((property, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${getAppBaseUrl()}/${locale}/marketplace/${property.id}`,
            name: property.title,
        })),
    }

    const pageHref = (targetPage: number) =>
        targetPage > 1
            ? `/${locale}/marketplace/city/${citySlug}?page=${targetPage}`
            : `/${locale}/marketplace/city/${citySlug}`

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
                        Locations disponibles a {city}
                    </h1>
                    <p className="max-w-3xl text-sm text-secondary">
                        Parcourez les annonces publiees a {city}, comparez les loyers et contactez les proprietaires.
                    </p>
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/${locale}/marketplace`}>Retour a la marketplace</Link>
                    </Button>
                </section>

                {properties.length === 0 ? (
                    <EmptyState
                        title={`Aucun bien disponible a ${city}`}
                        description="Revenez plus tard ou explorez les autres villes."
                        icon={<Building2 className="h-6 w-6" />}
                        actionLabel="Voir toutes les annonces"
                        actionHref={`/${locale}/marketplace`}
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
                                    <Link href={pageHref(clampedPage - 1)}>Precedent</Link>
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
                                    <Link href={pageHref(clampedPage + 1)}>Suivant</Link>
                                </Button>
                            )}
                        </nav>
                    </>
                )}
            </main>
        </div>
    )
}
