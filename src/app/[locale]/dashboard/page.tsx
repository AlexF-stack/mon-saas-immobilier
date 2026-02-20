import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Users, Building, CreditCard, FileText } from 'lucide-react'
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default async function DashboardPage(props: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await props.params
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null
    const role = user?.role || 'GUEST'
    const userId = user?.id

    if (role === 'TENANT' && userId) {
        const [activeContract, recentPayments] = await Promise.all([
            prisma.contract.findFirst({
                where: { tenantId: userId, status: 'ACTIVE' },
                include: { property: true },
                orderBy: { endDate: 'desc' },
            }),
            prisma.payment.findMany({
                where: { contract: { tenantId: userId } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { contract: { include: { property: true } } },
            }),
        ])

        const nextRent = activeContract?.rentAmount ?? 0
        const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

        const activityItems = recentPayments.map((p) => ({
            id: p.id,
            type: 'payment' as const,
            title: p.contract.property.title,
            subtitle: p.method,
            amount: p.amount,
            date: p.createdAt,
            href: `/${locale}/dashboard/payments`,
        }))

        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mon Espace Locataire</h1>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <StatCard
                        title="Mon Contrat"
                        value={activeContract ? activeContract.property.title : 'Aucun contrat actif'}
                        subtitle={activeContract ? `Actif · Expire le ${formatDate(activeContract.endDate)}` : "Vous n'avez pas de bail en cours."}
                        icon={<FileText className="h-5 w-5" />}
                        iconBg="primary"
                    />
                    <StatCard
                        title="Prochain Loyer"
                        value={`${nextRent.toLocaleString('fr-FR')} FCFA`}
                        subtitle="À payer selon les termes du contrat"
                        icon={<CreditCard className="h-5 w-5" />}
                        iconBg="accent"
                    />
                </div>
                {recentPayments.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Derniers paiements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecentActivity items={activityItems} />
                        </CardContent>
                    </Card>
                )}
            </div>
        )
    }

    const isAdmin = role === 'ADMIN'
    const basePropertyWhere = isAdmin ? {} : { managerId: userId }

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
        totalRevenueResult,
        propertiesCount,
        availableCount,
        activeContractsCount,
        expiringSoonCount,
        tenantsCount,
        totalUsersCount,
        lastMonthRevenueResult,
        paymentsLast6Months,
        recentPaymentsForActivity,
    ] = await Promise.all([
        prisma.payment.aggregate({
            where: {
                status: 'COMPLETED',
                contract: { property: basePropertyWhere },
            },
            _sum: { amount: true },
        }),
        prisma.property.count({ where: basePropertyWhere }),
        prisma.property.count({ where: { ...basePropertyWhere, status: 'AVAILABLE' } }),
        prisma.contract.count({
            where: { status: 'ACTIVE', property: basePropertyWhere },
        }),
        prisma.contract.count({
            where: {
                status: 'ACTIVE',
                property: basePropertyWhere,
                endDate: { gte: now, lte: thirtyDaysFromNow },
            },
        }),
        isAdmin
            ? prisma.user.count({ where: { role: 'TENANT' } })
            : prisma.contract.findMany({
                where: { property: basePropertyWhere },
                select: { tenantId: true },
                distinct: ['tenantId'],
            }).then((r) => r.length),
        isAdmin ? prisma.user.count() : Promise.resolve(0),
        prisma.payment.aggregate({
            where: {
                status: 'COMPLETED',
                contract: { property: basePropertyWhere },
                createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
                    lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
            },
            _sum: { amount: true },
        }),
        prisma.payment.findMany({
            where: {
                status: 'COMPLETED',
                contract: { property: basePropertyWhere },
                createdAt: { gte: sixMonthsAgo },
            },
            select: { amount: true, createdAt: true },
        }),
        prisma.payment.findMany({
            where: { contract: { property: basePropertyWhere } },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: { contract: { include: { property: true, tenant: true } } },
        }),
    ])

    const totalRevenue = Number(totalRevenueResult._sum.amount ?? 0)
    const lastMonthRevenue = Number(lastMonthRevenueResult._sum.amount ?? 0)
    const revenueGrowth = lastMonthRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

    const monthlyMap: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        d.setDate(1)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        monthlyMap[key] = 0
    }
    paymentsLast6Months.forEach((p) => {
        const d = new Date(p.createdAt)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (key in monthlyMap) monthlyMap[key] += p.amount
    })
    const chartData = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, revenue]) => {
            const [y, m] = key.split('-').map(Number)
            return { month: MONTH_NAMES[m], revenue, label: `${MONTH_NAMES[m]} ${y}` }
        })

    const activityItems = recentPaymentsForActivity.map((p) => ({
        id: p.id,
        type: 'payment' as const,
        title: p.contract.property.title,
        subtitle: p.contract.tenant.name || p.contract.tenant.email,
        amount: p.amount,
        date: p.createdAt,
        href: `/${locale}/dashboard/payments`,
    }))

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Tableau de Bord {role === 'MANAGER' ? 'Gestionnaire' : 'Administrateur'}
            </h1>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <StatCard
                    title={isAdmin ? 'Revenus Plateforme' : 'Mes Revenus'}
                    value={`${totalRevenue.toLocaleString('fr-FR')} FCFA`}
                    trend={{ value: revenueGrowth, label: 'vs mois dernier' }}
                    icon={<CreditCard className="h-5 w-5" />}
                    iconBg="primary"
                />
                <StatCard
                    title={isAdmin ? 'Total Biens' : 'Mes Biens'}
                    value={propertiesCount}
                    subtitle={`${availableCount} disponibles`}
                    icon={<Building className="h-5 w-5" />}
                    iconBg="accent"
                />
                <StatCard
                    title={isAdmin ? 'Total Locataires' : 'Mes Locataires'}
                    value={tenantsCount}
                    subtitle={isAdmin ? `${totalUsersCount} utilisateurs` : 'avec contrat actif'}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="muted"
                />
                <StatCard
                    title="Contrats Actifs"
                    value={activeContractsCount}
                    subtitle={expiringSoonCount > 0 ? `${expiringSoonCount} expire(nt) bientôt` : 'Aucune expiration proche'}
                    icon={<FileText className="h-5 w-5" />}
                    iconBg={expiringSoonCount > 0 ? 'warning' : 'muted'}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Revenus (6 derniers mois)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RevenueChart data={chartData} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Activité récente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RecentActivity items={activityItems} />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

