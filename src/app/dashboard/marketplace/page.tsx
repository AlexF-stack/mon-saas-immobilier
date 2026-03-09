import Link from 'next/link'
import { CalendarClock, Globe, Megaphone, Plus, ShieldCheck } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { MarketplacePublishingTable } from '@/components/dashboard/MarketplacePublishingTable'

export default async function DashboardMarketplacePage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null

    if (!user) {
        redirect('/login')
    }

    if (user.role === 'TENANT') {
        redirect('/dashboard')
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

    const total = properties.length
    const publishedCount = properties.filter((property) => property.isPublished).length
    const availableCount = properties.filter((property) => property.status === 'AVAILABLE').length

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
                    <Link href="/dashboard/properties/new">
                        <Plus className="h-4 w-4" />
                        Nouveau bien
                    </Link>
                </Button>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
            </div>

            {properties.length === 0 ? (
                <EmptyState
                    title="Aucun bien a publier"
                    description="Creez d abord un bien pour le rendre visible dans la marketplace."
                    actionLabel="Ajouter un bien"
                    actionHref="/dashboard/properties/new"
                />
            ) : (
                <MarketplacePublishingTable
                    dashboardPathPrefix="/dashboard"
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
                                                ? new Date(inquiry.preferredVisitDate).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td className="px-2 py-2">
                                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                                                {inquiry.status}
                                            </span>
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
