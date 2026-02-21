import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import ThemeToggle from '@/components/ui/theme-toggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { getLandingPricingPlans, type LandingPricingPlan } from '@/lib/landing-pricing'
import {
    BarChart3,
    Building2,
    CreditCard,
    FileText,
    Home,
    Menu,
    Sparkles,
    Star,
    type LucideIcon,
} from 'lucide-react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

const pricingFeatureIcons: Record<LandingPricingPlan['key'], LucideIcon[]> = {
    basic: [Home, FileText, Sparkles],
    pro: [Building2, FileText, CreditCard],
    premium: [Sparkles, BarChart3, CreditCard],
}

export default async function LandingPage(props: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await props.params
    const t = await getTranslations({ locale })

    const pricingSectionId = 'pricing'
    const pricingSectionHref = `/${locale}#${pricingSectionId}`

    const [featuredProperties, pricingPlans] = await Promise.all([
        prisma.property.findMany({
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
        }),
        getLandingPricingPlans(locale),
    ])

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
    const pricingTitle = locale === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'
    const pricingSubtitle =
        locale === 'fr'
            ? 'Des options adaptees aux proprietaires, locataires et gestionnaires.'
            : 'Plans built for tenants, owners and managers.'
    const pricingPopularLabel = locale === 'fr' ? 'Populaire' : 'Popular'
    const pricingCustomQuestion =
        locale === 'fr' ? 'Besoin dun plan sur mesure ?' : 'Need a custom enterprise setup?'
    const pricingCustomLink = locale === 'fr' ? 'Demander une demo' : 'Request a demo'
    const heroEyebrow =
        locale === 'fr'
            ? 'Plateforme SaaS immobiliere complete'
            : 'Complete real estate SaaS platform'
    const heroTitle =
        locale === 'fr'
            ? 'Publiez vos biens, signez vos baux et encaissez vos loyers depuis une seule interface.'
            : 'Publish listings, sign leases and collect rent from one operating system.'
    const heroSubtitle =
        locale === 'fr'
            ? 'ImmoSaaS relie proprietaires, managers et locataires avec un workflow simple: marketplace, contrats, paiements et suivi en temps reel.'
            : 'ImmoSaaS connects owners, managers and tenants in one clear workflow: marketplace, contracts, payments and real-time tracking.'
    const heroSecondaryCta =
        locale === 'fr' ? 'Explorer les annonces' : 'Explore listings'
    const heroTrustLine =
        locale === 'fr'
            ? 'Concu pour les equipes terrain, les proprietaires et les locataires.'
            : 'Built for on-site teams, owners and tenants.'
    const heroJourneyTitle =
        locale === 'fr'
            ? 'Un parcours locatif clair de bout en bout'
            : 'A clear rental journey from start to finish'
    const heroJourneySubtitle =
        locale === 'fr'
            ? 'Chaque etape est tracee et securisee, de la publication au recu de paiement.'
            : 'Every step is tracked and secured, from listing to payment receipt.'
    const heroJourneySteps: Array<{ id: string; title: string; description: string; icon: LucideIcon }> =
        locale === 'fr'
            ? [
                  {
                      id: 'publish',
                      title: 'Publier un bien',
                      description: 'Mettez votre annonce en ligne avec disponibilite et prix.',
                      icon: Building2,
                  },
                  {
                      id: 'contract',
                      title: 'Creer le bail',
                      description: 'Associez le locataire et generez les documents en quelques clics.',
                      icon: FileText,
                  },
                  {
                      id: 'payment',
                      title: 'Suivre le paiement',
                      description: 'Recevez, confirmez et archivez les paiements en temps reel.',
                      icon: CreditCard,
                  },
              ]
            : [
                  {
                      id: 'publish',
                      title: 'Publish listing',
                      description: 'Go live with availability, rent and property details.',
                      icon: Building2,
                  },
                  {
                      id: 'contract',
                      title: 'Create lease',
                      description: 'Attach tenant data and generate contract docs in minutes.',
                      icon: FileText,
                  },
                  {
                      id: 'payment',
                      title: 'Track payment',
                      description: 'Receive, confirm and archive rent payments with full traceability.',
                      icon: CreditCard,
                  },
              ]

    return (
        <div className="animated-bg noise-overlay flex min-h-screen flex-col text-primary">
            <header className="fixed inset-x-0 top-0 z-40 w-full border-b border-border/70 bg-[rgb(var(--card)/0.84)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgb(var(--card)/0.76)]">
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
                />
                <div className="container-app relative flex flex-wrap items-center gap-3 py-4 sm:gap-4">
                    <Link
                        href={`/${locale}`}
                        className="group flex items-center gap-2 text-lg font-bold text-primary"
                    >
                        <span className="elevation-1 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-extrabold text-white transition-transform [transition-duration:var(--motion-hover)] [transition-timing-function:var(--ease-standard)] group-hover:-translate-y-px">
                            I
                        </span>
                        <span>ImmoSaaS</span>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        <Link
                            href={`/${locale}#features`}
                            className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80 hover:text-primary"
                        >
                            {t('nav.features')}
                        </Link>
                        <Link
                            href={pricingSectionHref}
                            className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80 hover:text-primary"
                        >
                            {t('nav.pricing')}
                        </Link>
                        <Link
                            href={`/${locale}/marketplace`}
                            className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80 hover:text-primary"
                        >
                            Marketplace
                        </Link>
                    </nav>
                    <div className="ml-auto hidden items-center gap-2 md:flex">
                        <div className="elevation-1 flex items-center gap-1 rounded-full border border-border/70 bg-card/75 p-1 backdrop-blur-sm">
                            <ThemeToggle />
                            <LanguageSwitcher />
                        </div>
                        <Link href={`/${locale}/login`}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="whitespace-nowrap rounded-full"
                            >
                                {locale === 'fr' ? 'Connexion' : 'Login'}
                            </Button>
                        </Link>
                        <Link href={`/${locale}/register`}>
                            <Button variant="cta" size="sm" className="hover-lift-soft whitespace-nowrap rounded-full sm:h-9">
                                {t('nav.getStarted')}
                            </Button>
                        </Link>
                    </div>
                    <div className="ml-auto flex items-center gap-2 md:hidden">
                        <div className="elevation-1 flex items-center gap-1 rounded-full border border-border/70 bg-card/75 p-1 backdrop-blur-sm">
                            <ThemeToggle />
                            <LanguageSwitcher />
                        </div>
                        <details className="relative">
                            <summary className="elevation-1 flex cursor-pointer list-none items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80">
                                <Menu className="h-4 w-4" aria-hidden />
                                <span>{locale === 'fr' ? 'Menu' : 'Menu'}</span>
                            </summary>
                            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-card/95 p-2 shadow-lift backdrop-blur-xl">
                                <nav className="flex flex-col gap-1 text-sm">
                                    <Link
                                        href={`/${locale}#features`}
                                        className="rounded-xl px-3 py-2 text-secondary transition-colors hover:bg-surface hover:text-primary"
                                    >
                                        {t('nav.features')}
                                    </Link>
                                    <Link
                                        href={pricingSectionHref}
                                        className="rounded-xl px-3 py-2 text-secondary transition-colors hover:bg-surface hover:text-primary"
                                    >
                                        {t('nav.pricing')}
                                    </Link>
                                    <Link
                                        href={`/${locale}/marketplace`}
                                        className="rounded-xl px-3 py-2 text-secondary transition-colors hover:bg-surface hover:text-primary"
                                    >
                                        Marketplace
                                    </Link>
                                    <div className="my-1 h-px bg-border" />
                                    <Button asChild variant="outline" size="sm" className="w-full rounded-full">
                                        <Link href={`/${locale}/login`}>
                                            {locale === 'fr' ? 'Connexion' : 'Login'}
                                        </Link>
                                    </Button>
                                    <Button asChild variant="cta" size="sm" className="w-full rounded-full">
                                        <Link href={`/${locale}/register`}>{t('nav.getStarted')}</Link>
                                    </Button>
                                </nav>
                            </div>
                        </details>
                    </div>
                </div>
            </header>

            <main className="flex-1 pt-24">
                <section className="py-16 sm:py-24">
                    <div className="container-app grid items-center gap-10 lg:grid-cols-2">
                        <div className="animate-fade-up space-y-6">
                            <Badge
                                variant="outline"
                                className="w-fit rounded-full border-primary/25 bg-[rgb(var(--primary)/0.08)] text-primary"
                            >
                                {heroEyebrow}
                            </Badge>
                            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
                                {heroTitle}
                            </h1>
                            <p className="max-w-xl text-lg text-secondary">{heroSubtitle}</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Link href={`/${locale}/register`}>
                                    <Button variant="cta" className="shadow-card hover-lift-soft">{t('landing.hero.cta')}</Button>
                                </Link>
                                <Link
                                    href={`/${locale}/marketplace`}
                                    className="inline-flex items-center text-secondary transition-colors hover:text-primary hover:underline"
                                >
                                    {heroSecondaryCta}
                                </Link>
                            </div>
                            <p className="text-sm text-secondary">{heroTrustLine}</p>
                        </div>

                        <div aria-hidden className="relative animate-fade-up stagger-2 depth-wrapper floating">
                            <div className="glass-card depth-layer p-6 shadow-lift">
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                                        {heroJourneyTitle}
                                    </p>
                                    <p className="text-sm text-secondary">{heroJourneySubtitle}</p>
                                </div>
                                <div className="mt-5 space-y-3">
                                    {heroJourneySteps.map((step) => {
                                        const Icon = step.icon
                                        return (
                                            <article
                                                key={step.id}
                                                className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-soft"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--primary)/0.12)] text-primary">
                                                        <Icon className="h-4 w-4" aria-hidden />
                                                    </span>
                                                    <div className="space-y-1">
                                                        <h3 className="text-sm font-semibold text-primary">
                                                            {step.title}
                                                        </h3>
                                                        <p className="text-sm text-secondary">
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </article>
                                        )
                                    })}
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
                                {featuredProperties.map((property, index) => (
                                    <div
                                        key={property.id}
                                        className={`depth-wrapper animate-fade-up ${index < 6 ? `stagger-${index + 1}` : ''}`}
                                    >
                                        <Card className="depth-layer glass-card overflow-hidden">
                                            <div className="h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                {property.images[0]?.url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={property.images[0].url}
                                                        alt={property.title}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-sm text-secondary">
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
                                                <p className="line-clamp-1 text-sm text-secondary">
                                                    {[property.city, property.address].filter(Boolean).join(', ')}
                                                </p>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <p className="text-2xl font-semibold tracking-tight text-primary">
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section id="features" className="py-12">
                    <div className="container-app">
                        <h2 className="mb-6 text-2xl font-bold">{t('landing.features.title')}</h2>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <article className="animate-fade-up stagger-1 transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
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
                            <article className="animate-fade-up stagger-2 transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
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
                            <article className="animate-fade-up stagger-3 transform rounded-xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1 hover:shadow-lift">
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

                <section id={pricingSectionId} className="scroll-mt-24 py-12">
                    <div className="container-app space-y-8">
                        <div className="mx-auto max-w-2xl space-y-2 text-center">
                            <h2 className="text-2xl font-bold sm:text-3xl">{pricingTitle}</h2>
                            <p className="text-secondary">{pricingSubtitle}</p>
                        </div>

                        <div className="depth-wrapper grid grid-cols-1 gap-6 lg:grid-cols-3">
                            {pricingPlans.map((plan, index) => (
                                <Card
                                    key={plan.key}
                                    className={[
                                        'relative h-full animate-fade-up border-border bg-card transition-all duration-200 hover:-translate-y-1 hover-lift-soft depth-layer glass-card',
                                        index === 0 ? 'stagger-1' : index === 1 ? 'stagger-2' : 'stagger-3',
                                        plan.popular
                                            ? 'ring-1 ring-primary/30 shadow-lift'
                                            : 'shadow-soft hover:shadow-card',
                                    ].join(' ')}
                                >
                                    {plan.popular ? (
                                        <div className="absolute right-4 top-4">
                                            <Badge
                                                variant="default"
                                                className="inline-flex items-center gap-1"
                                            >
                                                <Star className="h-3.5 w-3.5" aria-hidden />
                                                <span>{pricingPopularLabel}</span>
                                            </Badge>
                                        </div>
                                    ) : null}

                                    <CardHeader
                                        className={plan.popular ? 'space-y-3 pr-20' : 'space-y-3'}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                                        </div>
                                        <p className="text-sm text-secondary">{plan.description}</p>
                                        <div className="space-y-1">
                                            <p className="text-3xl font-semibold tracking-tight text-primary">
                                                {plan.price}
                                            </p>
                                            <p className="text-sm text-secondary">{plan.cadence}</p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <ul className="space-y-3">
                                            {plan.features.map((featureLabel, featureIndex) => {
                                                const Icon =
                                                    pricingFeatureIcons[plan.key][featureIndex] ??
                                                    Sparkles
                                                return (
                                                    <li
                                                        key={`${plan.key}-${featureLabel}`}
                                                        className="flex items-center gap-3"
                                                    >
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--primary)/0.12)] text-primary">
                                                            <Icon className="h-4 w-4" aria-hidden />
                                                        </span>
                                                        <span className="text-sm text-primary">
                                                            {featureLabel}
                                                        </span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-secondary">
                                            {plan.note}
                                        </p>
                                    </CardContent>

                                    <CardFooter className="mt-auto">
                                        <Button
                                            asChild
                                            className="w-full"
                                            variant={plan.popular ? 'cta' : 'outline'}
                                        >
                                            <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>

                        <p className="text-center text-sm text-secondary">
                            {pricingCustomQuestion}{' '}
                            <Link
                                href={`/${locale}/login`}
                                className="font-medium text-primary hover:underline"
                            >
                                {pricingCustomLink}
                            </Link>
                        </p>
                    </div>
                </section>

                <section id="demo" className="py-12">
                    <div className="container-app flex justify-center">
                        <div className="w-full max-w-5xl overflow-hidden rounded-2xl shadow-lift animate-scale-in glass-card">
                            <div className="relative rounded-2xl p-6">
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
                            <div className="animate-fade-up stagger-1 rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">+18%</p>
                                <p className="text-secondary">Increase profitability</p>
                            </div>
                            <div className="animate-fade-up stagger-2 rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">-40%</p>
                                <p className="text-secondary">Reduce vacancy</p>
                            </div>
                            <div className="animate-fade-up stagger-3 rounded-xl border border-border bg-card p-6 text-center shadow-soft">
                                <p className="text-2xl font-bold">Track ROI</p>
                                <p className="text-secondary">Clear, exportable metrics</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container-app flex justify-center">
                        <div className="w-full max-w-3xl rounded-2xl bg-gradient-to-r from-[rgb(var(--primary)/0.12)] to-[rgb(var(--accent)/0.08)] p-8 text-center shadow-card animate-fade-up hover-lift-soft glass-card">
                            <h3 className="mb-2 text-2xl font-bold">{t('landing.cta.title')}</h3>
                            <p className="mb-6 text-secondary">{t('landing.cta.subtitle')}</p>
                            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                                <Link href={`/${locale}/register`}>
                                    <Button variant="cta" className="px-8 hover-lift-soft">{t('landing.cta.button')}</Button>
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
                    <nav className="flex gap-4 sm:ml-auto">
                        <Link href="#">Terms</Link>
                        <Link href="#">Privacy</Link>
                    </nav>
                </div>
            </footer>
        </div>
    )
}
