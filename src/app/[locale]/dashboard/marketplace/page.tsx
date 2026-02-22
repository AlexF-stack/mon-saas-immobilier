import Link from 'next/link'
import { BarChart3, Plus } from 'lucide-react'
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
        </section>
    )
}
