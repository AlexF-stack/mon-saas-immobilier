import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, Home, MapPin } from 'lucide-react'
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader'
import { MarketplaceInquiryForm } from '@/components/marketplace/MarketplaceInquiryForm'

function propertyTypeLabel(propertyType: string) {
    if (propertyType === 'APARTMENT') return 'Appartement'
    if (propertyType === 'HOUSE') return 'Maison'
    if (propertyType === 'STUDIO') return 'Studio'
    if (propertyType === 'COMMERCIAL') return 'Commercial'
    return propertyType
}

function getBaseUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

function resolveOgImage(
    imageUrl: string | null | undefined,
    fallbackTitle: string,
    fallbackSubtitle: string
): string {
    if (!imageUrl) {
        const params = new URLSearchParams({ title: fallbackTitle, subtitle: fallbackSubtitle })
        return `${getBaseUrl()}/api/og/marketplace?${params.toString()}`
    }
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl
    return `${getBaseUrl()}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`
}

async function getPublishedMarketplaceProperty(propertyId: string) {
    return prisma.property.findFirst({
        where: {
            id: propertyId,
            isPublished: true,
            status: 'AVAILABLE',
        },
        select: {
            id: true,
            title: true,
            description: true,
            city: true,
            address: true,
            price: true,
            status: true,
            propertyType: true,
            isPremium: true,
            viewsCount: true,
            inquiriesCount: true,
            publishedAt: true,
            images: {
                select: { id: true, url: true },
                orderBy: { id: 'asc' },
            },
            manager: {
                select: { name: true, email: true },
            },
        },
    })
}

export async function generateMetadata(props: {
    params: Promise<{ locale: string; propertyId: string }>
}): Promise<Metadata> {
    const { locale, propertyId } = await props.params
    const property = await getPublishedMarketplaceProperty(propertyId)

    if (!property) {
        return {
            title: 'Annonce introuvable | Marketplace ImmoSaaS',
            description: 'Le bien recherche n est plus disponible sur la marketplace.',
        }
    }

    const price = `${property.price.toLocaleString('fr-FR')} FCFA`
    const location = property.city ? `${property.city}, ${property.address}` : property.address
    const title = `${property.title} - ${price} | Marketplace ImmoSaaS`
    const description = property.description
        ? `${property.description.slice(0, 140)}${property.description.length > 140 ? '...' : ''}`
        : `${propertyTypeLabel(property.propertyType)} disponible a ${location}. Loyer ${price}.`
    const canonicalPath = `/${locale}/marketplace/${property.id}`
    const ogImage = resolveOgImage(property.images[0]?.url, property.title, description)

    return {
        title,
        description,
        alternates: { canonical: canonicalPath },
        openGraph: {
            title,
            description,
            type: 'article',
            locale,
            url: `${getBaseUrl()}${canonicalPath}`,
            images: [{ url: ogImage, alt: property.title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
    }
}

export default async function MarketplacePropertyDetailPage(props: {
    params: Promise<{ locale: string; propertyId: string }>
}) {
    const { locale, propertyId } = await props.params
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null

    const property = await getPublishedMarketplaceProperty(propertyId)
    if (!property) notFound()

    await prisma.property.update({
        where: { id: property.id },
        data: { viewsCount: { increment: 1 } },
        select: { id: true },
    })

    const canonicalUrl = `${getBaseUrl()}/${locale}/marketplace/${property.id}`
    const listingType =
        property.propertyType === 'HOUSE'
            ? 'House'
            : property.propertyType === 'STUDIO'
                ? 'Apartment'
                : property.propertyType === 'COMMERCIAL'
                    ? 'Place'
                    : 'Apartment'
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Offer',
        url: canonicalUrl,
        availability: 'https://schema.org/InStock',
        priceCurrency: 'XOF',
        price: property.price,
        itemOffered: {
            '@type': listingType,
            name: property.title,
            description: property.description ?? '',
            address: {
                '@type': 'PostalAddress',
                streetAddress: property.address,
                addressLocality: property.city ?? '',
            },
            image: property.images.map((image) => resolveOgImage(image.url, property.title, property.address)),
        },
        seller: {
            '@type': 'RealEstateAgent',
            name: property.manager?.name ?? 'ImmoSaaS',
        },
    }

    return (
        <div className="min-h-screen bg-background text-primary">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <MarketplaceHeader locale={locale} isAuthenticated={Boolean(user)} />

            <main className="container-app space-y-8 py-8">
                <div className="flex items-center justify-between gap-4">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/${locale}/marketplace`}>Retour a la marketplace</Link>
                    </Button>
                    <div className="flex items-center gap-2">
                        {property.isPremium ? <Badge variant="default">Premium</Badge> : null}
                        <Badge variant="success">Disponible</Badge>
                    </div>
                </div>

                <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                            {property.images.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
                                    {property.images.map((image) => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            key={image.id}
                                            src={image.url}
                                            alt={property.title}
                                            className="h-56 w-full rounded-xl object-cover md:h-64"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-72 items-center justify-center bg-gradient-to-br from-surface to-[rgb(var(--card)/0.9)] text-secondary">
                                    Aucune image disponible
                                </div>
                            )}
                        </div>

                        <Card>
                            <CardHeader className="space-y-3">
                                <CardTitle className="text-2xl">{property.title}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{propertyTypeLabel(property.propertyType)}</Badge>
                                    <Badge variant="secondary">
                                        <MapPin className="h-3 w-3" />
                                        {property.city ? `${property.city}, ${property.address}` : property.address}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                                    {property.price.toLocaleString('fr-FR')} FCFA
                                </p>
                                <p className="text-sm leading-relaxed text-secondary">
                                    {property.description || 'Ce bien ne contient pas encore de description detaillee.'}
                                </p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                                        <p className="text-xs uppercase tracking-wide text-secondary">
                                            Type de bien
                                        </p>
                                        <p className="font-medium text-primary">
                                            {propertyTypeLabel(property.propertyType)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                                        <p className="text-xs uppercase tracking-wide text-secondary">
                                            Disponibilite
                                        </p>
                                        <p className="font-medium text-primary">
                                            Immediate
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                                        <p className="text-xs uppercase tracking-wide text-secondary">
                                            Interet recu
                                        </p>
                                        <p className="font-medium text-primary">
                                            {property.inquiriesCount} demandes
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Postuler / Demander visite</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MarketplaceInquiryForm
                                    propertyId={property.id}
                                    defaultName={user?.name ?? undefined}
                                    defaultEmail={user?.email ?? undefined}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Informations publiques</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-secondary">
                                <div className="flex items-center gap-2">
                                    <Home className="h-4 w-4 text-secondary" />
                                    <span>{propertyTypeLabel(property.propertyType)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-secondary" />
                                    <span>
                                        Publie le{' '}
                                        {property.publishedAt
                                            ? property.publishedAt.toLocaleDateString('fr-FR')
                                            : 'recentement'}
                                    </span>
                                </div>
                                {property.manager?.name && (
                                    <p className="text-xs text-secondary">
                                        Contact proprietaire: {property.manager.name}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </main>
        </div>
    )
}
