import Link from 'next/link'
import { BarChart3, CalendarClock, Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
    const inquiryWhereClause = user.role === 'ADMIN' ? {} : { property: { managerId: user.id } }
    const [properties, inquiries] = await Promise.all([
        prisma.property.findMany({
            where: whereClause,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                city: true,
                address: true,
                price: true,
                offerType: true,
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
        }),
        prisma.marketplaceInquiry.findMany({
            where: inquiryWhereClause,
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                requesterName: true,
                requesterEmail: true,
                requesterPhone: true,
                status: true,
                preferredVisitDate: true,
                createdAt: true,
                property: { select: { title: true } },
            },
        }),
    ])

    return (
        <section className="space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gestion marketplace</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Publiez, retirez et pilotez la visibilite publique de vos annonces.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link href={`/${locale}/dashboard/statistics`}>
                            <BarChart3 className="h-4 w-4" />
                            Voir les statistiques
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/${locale}/dashboard/properties/new`}>
                            <Plus className="h-4 w-4" />
                            Nouveau bien
                        </Link>
                    </Button>
                </div>
            </header>

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

            <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-soft">
                <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        <h2 className="text-base font-semibold">Demandes de visite recentes</h2>
                    </div>
                    <span className="text-xs text-secondary">{inquiries.length} recues</span>
                </header>

                {inquiries.length === 0 ? (
                    <p className="text-sm text-secondary">
                        Aucune demande recente. Les demandes marketplace apparaitront ici.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-secondary">
                                    <th className="px-2 py-2">Bien</th>
                                    <th className="px-2 py-2">Demandeur</th>
                                    <th className="px-2 py-2">Contact</th>
                                    <th className="px-2 py-2">Date visite</th>
                                    <th className="px-2 py-2">Statut</th>
                                    <th className="px-2 py-2">Discussion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inquiries.map((inquiry) => (
                                    <tr key={inquiry.id} className="border-b border-border/60">
                                        <td className="px-2 py-2 font-medium text-primary">{inquiry.property.title}</td>
                                        <td className="px-2 py-2 text-primary">{inquiry.requesterName}</td>
                                        <td className="px-2 py-2 text-secondary">
                                            <div>{inquiry.requesterEmail}</div>
                                            {inquiry.requesterPhone ? <div>{inquiry.requesterPhone}</div> : null}
                                        </td>
                                        <td className="px-2 py-2 text-secondary">
                                            {inquiry.preferredVisitDate
                                                ? new Date(inquiry.preferredVisitDate).toLocaleDateString(locale)
                                                : '-'}
                                        </td>
                                        <td className="px-2 py-2">
                                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                                                {inquiry.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2">
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/${locale}/dashboard/marketplace/inquiries?inquiryId=${inquiry.id}`}>
                                                    Ouvrir discussion
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    )
}
