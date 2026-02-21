import Link from 'next/link'
import { BarChart3, Globe, Megaphone, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { MarketplacePublishingTable } from '@/components/dashboard/MarketplacePublishingTable'

export default async function DashboardMarketplacePage(props: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await props.params
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null

    if (!user) {
        redirect(`/${locale}/login`)
    }

    if (user.role === 'TENANT') {
        forbidden()
    }

    const whereClause = user.role === 'ADMIN' ? {} : { managerId: user.id }
    const properties = await prisma.property.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            title: true,
            city: true,
            address: true,
            price: true,
            status: true,
            propertyType: true,
            isPublished: true,
            isPremium: true,
            viewsCount: true,
            impressionsCount: true,
            inquiriesCount: true,
            publishedAt: true,
            createdAt: true,
        },
    })

    const propertyIds = properties.map((property) => property.id)
    const firstInquiryByProperty =
        propertyIds.length > 0
            ? await prisma.marketplaceInquiry.groupBy({
                  by: ['propertyId'],
                  where: { propertyId: { in: propertyIds } },
                  _min: { createdAt: true },
              })
            : []

    const total = properties.length
    const publishedCount = properties.filter((property) => property.isPublished).length
    const availableCount = properties.filter((property) => property.status === 'AVAILABLE').length
    const premiumCount = properties.filter((property) => property.isPremium).length
    const totalImpressions = properties.reduce((sum, property) => sum + property.impressionsCount, 0)
    const totalViews = properties.reduce((sum, property) => sum + property.viewsCount, 0)
    const totalInquiries = properties.reduce((sum, property) => sum + property.inquiriesCount, 0)
    const ctr = totalImpressions > 0 ? (totalViews / totalImpressions) * 100 : 0
    const inquiryRate = totalViews > 0 ? (totalInquiries / totalViews) * 100 : 0

    const cityBuckets = new Map<
        string,
        { impressions: number; views: number; inquiries: number }
    >()
    for (const property of properties) {
        const city = property.city?.trim()
        if (!city) continue
        const previous = cityBuckets.get(city) ?? { impressions: 0, views: 0, inquiries: 0 }
        cityBuckets.set(city, {
            impressions: previous.impressions + property.impressionsCount,
            views: previous.views + property.viewsCount,
            inquiries: previous.inquiries + property.inquiriesCount,
        })
    }
    const cityMetrics = [...cityBuckets.entries()]
        .map(([city, data]) => ({
            city,
            ctr: data.impressions > 0 ? (data.views / data.impressions) * 100 : 0,
            inquiryRate: data.views > 0 ? (data.inquiries / data.views) * 100 : 0,
        }))
        .sort((a, b) => b.inquiryRate - a.inquiryRate)
        .slice(0, 5)

    const firstInquiryMap = new Map(
        firstInquiryByProperty.map((entry) => [entry.propertyId, entry._min.createdAt])
    )
    const conversionDurationsHours: number[] = []
    for (const property of properties) {
        const firstInquiry = firstInquiryMap.get(property.id)
        const startDate = property.publishedAt ?? property.createdAt
        if (!firstInquiry || !startDate) continue
        const duration = (firstInquiry.getTime() - startDate.getTime()) / (1000 * 60 * 60)
        if (duration >= 0) conversionDurationsHours.push(duration)
    }
    const avgHoursToInquiry =
        conversionDurationsHours.length > 0
            ? conversionDurationsHours.reduce((sum, value) => sum + value, 0) /
              conversionDurationsHours.length
            : 0

    return (
        <section className="space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gestion marketplace</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Publiez, retirez et pilotez la visibilite publique de vos annonces.
                    </p>
                </div>
                <Button asChild>
                    <Link href={`/${locale}/dashboard/properties/new`}>
                        <Plus className="h-4 w-4" />
                        Nouveau bien
                    </Link>
                </Button>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 xl:grid-cols-6">
                <StatCard
                    title="Biens totaux"
                    value={total}
                    subtitle="Dans votre perimetre"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    iconBg="primary"
                />
                <StatCard
                    title="Publies"
                    value={publishedCount}
                    subtitle="Visibles publiquement"
                    icon={<Globe className="h-5 w-5" />}
                    iconBg="success"
                />
                <StatCard
                    title="Disponibles"
                    value={availableCount}
                    subtitle="Eligibles a la publication"
                    icon={<Megaphone className="h-5 w-5" />}
                    iconBg="warning"
                />
                <StatCard
                    title="Premium"
                    value={premiumCount}
                    subtitle="Boost business actif"
                    icon={<Sparkles className="h-5 w-5" />}
                    iconBg="primary"
                />
                <StatCard
                    title="CTR annonces"
                    value={`${ctr.toFixed(1)}%`}
                    subtitle={`${totalViews} vues / ${totalImpressions} impressions`}
                    icon={<BarChart3 className="h-5 w-5" />}
                    iconBg="success"
                />
                <StatCard
                    title="Taux inquiry"
                    value={`${inquiryRate.toFixed(1)}%`}
                    subtitle={`${totalInquiries} demandes qualifiees`}
                    icon={<Globe className="h-5 w-5" />}
                    iconBg="warning"
                />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Analytics marketplace
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Suivi acquisition par ville et temps avant conversion inquiry.
                        </p>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Temps moyen avant inquiry: {avgHoursToInquiry.toFixed(1)}h
                    </p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {cityMetrics.length > 0 ? (
                        cityMetrics.map((cityMetric) => (
                            <div
                                key={cityMetric.city}
                                className="rounded-xl border border-border bg-surface/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/70"
                            >
                                <p className="font-medium text-slate-900 dark:text-slate-100">{cityMetric.city}</p>
                                <p className="text-slate-500 dark:text-slate-400">
                                    CTR: {cityMetric.ctr.toFixed(1)}% | Inquiry: {cityMetric.inquiryRate.toFixed(1)}%
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Donnees par ville insuffisantes pour le moment.
                        </p>
                    )}
                </div>
            </div>

            {properties.length === 0 ? (
                <EmptyState
                    title="Aucun bien a publier"
                    description="Creez d abord un bien pour le rendre visible dans la marketplace."
                    actionLabel="Ajouter un bien"
                    actionHref={`/${locale}/dashboard/properties/new`}
                />
            ) : (
                <MarketplacePublishingTable
                    locale={locale}
                    dashboardPathPrefix={`/${locale}/dashboard`}
                    canManagePremium={user.role === 'ADMIN'}
                    rows={properties.map((property) => ({
                        ...property,
                        publishedAt: property.publishedAt?.toISOString() ?? null,
                    }))}
                />
            )}
        </section>
    )
}
