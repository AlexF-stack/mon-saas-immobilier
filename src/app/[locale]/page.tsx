import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import ThemeToggle from '@/components/ui/theme-toggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Building2 } from 'lucide-react'

function propertyTypeLabel(propertyType: string, locale: string) {
    if (locale === 'fr') {
        if (propertyType === 'APARTMENT') return 'Appartement'
        if (propertyType === 'HOUSE') return 'Maison'
        if (propertyType === 'STUDIO') return 'Studio'
        if (propertyType === 'COMMERCIAL') return 'Commercial'
        return propertyType
    }

    if (propertyType === 'APARTMENT') return 'Apartment'
    if (propertyType === 'HOUSE') return 'House'
    if (propertyType === 'STUDIO') return 'Studio'
    if (propertyType === 'COMMERCIAL') return 'Commercial'
    return propertyType
}

export default async function LandingPage(props: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await props.params
    const t = await getTranslations({ locale })

    const featuredProperties = await prisma.property.findMany({
        where: {
            isPublished: true,
            status: 'AVAILABLE',
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
            id: true,
            title: true,
            city: true,
            address: true,
            price: true,
            propertyType: true,
            images: {
                select: { id: true, url: true },
                take: 1,
                orderBy: { id: 'asc' },
            },
        },
    })

    if (featuredProperties.length > 0) {
        await prisma.$transaction(
            featuredProperties.map((property) =>
                prisma.property.update({
                    where: { id: property.id },
                    data: { impressionsCount: { increment: 1 } },
                    select: { id: true },
                })
            )
        )
    }

    const marketplaceTitle = locale === 'fr' ? 'Annonces recentes' : 'Recent listings'
    const marketplaceSubtitle =
        locale === 'fr'
            ? 'Une selection des biens disponibles en ce moment.'
            : 'A curated selection of currently available properties.'
    const viewAllLabel = locale === 'fr' ? 'Voir toutes les annonces' : 'View all listings'
    const noListingTitle = locale === 'fr' ? 'Aucune annonce disponible' : 'No listing available'
    const noListingDescription =
        locale === 'fr'
            ? 'La marketplace sera mise a jour avec de nouvelles annonces tres bientot.'
            : 'New marketplace listings will be available soon.'

    return (
        <div className="flex min-h-screen flex-col bg-background text-primary">
            <header className="w-full border-b border-border">
                <div className="container-app flex items-center gap-6 py-4">
                    <Link href={`/${locale}`} className="text-lg font-bold">
                        ImmoSaaS
                    </Link>
                    <nav className="ml-auto hidden gap-6 sm:flex">
                        <Link href={`/${locale}#features`} className="text-secondary hover:underline">
                            {t('nav.features')}
                        </Link>
                        <Link href={`/${locale}#pricing`} className="text-secondary hover:underline">
                            {t('nav.pricing')}
                        </Link>
                        <Link href={`/${locale}/marketplace`} className="text-secondary hover:underline">
                            Marketplace
                        </Link>
                    </nav>
                    <div className="ml-4 flex items-center gap-2">
                        <ThemeToggle />
                        <LanguageSwitcher />
                        <Link href={`/${locale}/register`}>
                            <Button>{t('nav.getStarted')}</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <section className="py-16 sm:py-24">
                    <div className="container-app grid items-center gap-10 lg:grid-cols-2">
                        <div className="space-y-6">
                            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
                                {t('landing.hero.title')}
                            </h1>
                            <p className="max-w-xl text-lg text-secondary">{t('landing.hero.subtitle')}</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Link href={`/${locale}/register`}>
                                    <Button className="shadow-card">{t('landing.hero.cta')}</Button>
                                </Link>
                                <a href="#demo" className="inline-flex items-center text-secondary hover:underline">
                                    View Demo
                                </a>
                            </div>
                        </div>

                        <div aria-hidden className="relative">
                            <div className="rounded-2xl bg-gradient-to-br from-[rgb(var(--primary)/0.08)] to-[rgb(var(--background)/0.6)] p-6 shadow-lift">
                                <div className="transform-gpu rounded-xl bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-secondary">Portfolio Value</p>
                                            <p className="text-2xl font-bold">$4,256,321</p>
                                        </div>
                                        <div className="space-y-2">
                                            <StatCard
                                                title="Occupancy"
                                                value="96%"
                                                subtitle="Across properties"
                                                iconBg="success"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container-app space-y-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold">{marketplaceTitle}</h2>
                                <p className="text-sm text-secondary">{marketplaceSubtitle}</p>
                            </div>
                            <Button asChild variant="outline">
                                <Link href={`/${locale}/marketplace`}>{viewAllLabel}</Link>
                            </Button>
                        </div>

                        {featuredProperties.length === 0 ? (
                            <EmptyState
                                title={noListingTitle}
                                description={noListingDescription}
                                icon={<Building2 className="h-6 w-6" />}
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {featuredProperties.map((property) => (
                                    <Card key={property.id} className="overflow-hidden">
                                        <div className="h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            {property.images[0]?.url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={property.images[0].url}
                                                    alt={property.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                                    {locale === 'fr' ? 'Image indisponible' : 'Image unavailable'}
                                                </div>
                                            )}
                                        </div>
                                        <CardHeader className="space-y-2 pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <CardTitle className="line-clamp-1 text-base">{property.title}</CardTitle>
                                                <Badge variant="success">
                                                    {locale === 'fr' ? 'Disponible' : 'Available'}
                                                </Badge>
                                            </div>
                                            <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                                                {[property.city, property.address].filter(Boolean).join(', ')}
                                            </p>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                                                {property.price.toLocaleString('fr-FR')} FCFA
                                            </p>
                                            <Badge variant="outline">
                                                {propertyTypeLabel(property.propertyType, locale)}
                                            </Badge>
                                        </CardContent>
                                        <CardFooter>
                                            <Button asChild className="w-full">
                                                <Link href={`/${locale}/marketplace/${property.id}`}>
                                                    {locale === 'fr' ? 'Voir le detail' : 'View details'}
                                                </Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section id="features" className="py-12">
                    <div className="container-app">
                        <h2 className="mb-6 text-2xl font-bold">{t('landing.features.title')}</h2>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <article className="transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(var(--primary)/0.12)] text-primary">
                                        <span aria-hidden>1</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{t('landing.features.feature1')}</h3>
                                        <p className="text-sm text-secondary">{t('landing.features.feature1Desc')}</p>
                                    </div>
                                </div>
                            </article>
                            <article className="transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.12)] text-accent">
                                        <span aria-hidden>2</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{t('landing.features.feature2')}</h3>
                                        <p className="text-sm text-secondary">{t('landing.features.feature2Desc')}</p>
                                    </div>
                                </div>
                            </article>
                            <article className="transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(var(--success)/0.12)] text-success">
                                        <span aria-hidden>3</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{t('landing.features.feature3')}</h3>
                                        <p className="text-sm text-secondary">{t('landing.features.feature3Desc')}</p>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="demo" className="py-12">
                    <div className="container-app flex justify-center">
                        <div className="w-full max-w-5xl overflow-hidden rounded-2xl shadow-lift">
                            <div className="relative rounded-2xl bg-card p-6">
                                <div className="rounded-xl bg-gradient-to-br from-[rgb(var(--card)/0.9)] to-[rgb(var(--card)/0.95)] p-4">
                                    <div className="h-64 rounded-md bg-[linear-gradient(135deg,var(--surface),var(--card))]" />
                                </div>
                                <div className="pointer-events-none absolute inset-0 dark:bg-[rgba(255,255,255,0.03)] dark:backdrop-blur-sm" />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-8">
                    <div className="container-app">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">+18%</p>
                                <p className="text-secondary">Increase profitability</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">-40%</p>
                                <p className="text-secondary">Reduce vacancy</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">Track ROI</p>
                                <p className="text-secondary">Clear, exportable metrics</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container-app flex justify-center">
                        <div className="w-full max-w-3xl rounded-2xl bg-gradient-to-r from-[rgb(var(--primary)/0.12)] to-[rgb(var(--accent)/0.08)] p-8 text-center shadow-card">
                            <h3 className="mb-2 text-2xl font-bold">{t('landing.cta.title')}</h3>
                            <p className="mb-6 text-secondary">{t('landing.cta.subtitle')}</p>
                            <div className="flex justify-center gap-4">
                                <Link href={`/${locale}/register`}>
                                    <Button className="px-8">{t('landing.cta.button')}</Button>
                                </Link>
                                <Link href={`/${locale}/marketplace`} className="inline-flex items-center text-secondary hover:underline">
                                    {viewAllLabel}
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-border py-8">
                <div className="container-app flex flex-col items-center gap-4 sm:flex-row">
                    <p className="text-sm text-secondary">© 2026 ImmoSaaS. All rights reserved.</p>
                    <nav className="ml-auto flex gap-4">
                        <Link href="#">Terms</Link>
                        <Link href="#">Privacy</Link>
                    </nav>
                </div>
            </footer>
        </div>
    )
}
