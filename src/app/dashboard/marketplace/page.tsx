import Link from 'next/link'
import { Globe, Megaphone, Plus, ShieldCheck } from 'lucide-react'
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
        },
    })

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
        </section>
    )
}
