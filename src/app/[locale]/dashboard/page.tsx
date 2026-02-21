import Link from 'next/link'
import { cookies } from 'next/headers'
import { Users, Building, CreditCard, FileText, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']

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
    const formatDate = (date: Date) =>
      date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const tenantQuickActions = [
      { label: 'Voir mes paiements', href: `/${locale}/dashboard/payments` },
      { label: 'Voir mon bail', href: `/${locale}/dashboard/contracts` },
    ]

    const activityItems = recentPayments.map((payment) => ({
      id: payment.id,
      type: 'payment' as const,
      title: payment.contract.property.title,
      subtitle: payment.method,
      amount: payment.amount,
      date: payment.createdAt,
      href: `/${locale}/dashboard/payments`,
    }))

    return (
      <div className="space-y-6">
        <Card className="animate-fade-up overflow-hidden border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-blue-50/50 dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-blue-950/30">
          <CardHeader className="gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Espace locataire
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
                  Mon tableau de bord
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
                  Suivez votre bail, vos echeances et vos paiements en un seul endroit.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {tenantQuickActions.map((action, index) => (
                  <Button key={action.href} asChild variant={index === 0 ? 'default' : 'outline'} size="sm">
                    <Link href={action.href}>
                      {action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <StatCard
            title="Mon Contrat"
            value={activeContract ? activeContract.property.title : 'Aucun contrat actif'}
            subtitle={
              activeContract
                ? `Actif - expire le ${formatDate(activeContract.endDate)}`
                : "Vous n'avez pas de bail en cours."
            }
            icon={<FileText className="h-5 w-5" />}
            iconBg="primary"
            className="stagger-1"
          />
          <StatCard
            title="Prochain Loyer"
            value={`${nextRent.toLocaleString('fr-FR')} FCFA`}
            subtitle="A payer selon les termes du contrat"
            icon={<CreditCard className="h-5 w-5" />}
            iconBg="accent"
            className="stagger-2"
          />
        </div>

        {recentPayments.length > 0 && (
          <Card className="animate-fade-up stagger-3">
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
      : prisma.contract
          .findMany({
            where: { property: basePropertyWhere },
            select: { tenantId: true },
            distinct: ['tenantId'],
          })
          .then((rows) => rows.length),
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
  const occupancyRate = propertiesCount > 0 ? Math.round(((propertiesCount - availableCount) / propertiesCount) * 100) : 0
  const averageRevenuePerProperty = propertiesCount > 0 ? Math.round(totalRevenue / propertiesCount) : 0

  const monthlyMap: Record<string, number> = {}
  for (let index = 5; index >= 0; index--) {
    const date = new Date()
    date.setMonth(date.getMonth() - index)
    date.setDate(1)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    monthlyMap[key] = 0
  }

  paymentsLast6Months.forEach((payment) => {
    const date = new Date(payment.createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (key in monthlyMap) {
      monthlyMap[key] += payment.amount
    }
  })

  const chartData = Object.entries(monthlyMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, revenue]) => {
      const [year, month] = key.split('-').map(Number)
      return { month: MONTH_NAMES[month], revenue, label: `${MONTH_NAMES[month]} ${year}` }
    })

  const activityItems = recentPaymentsForActivity.map((payment) => ({
    id: payment.id,
    type: 'payment' as const,
    title: payment.contract.property.title,
    subtitle: payment.contract.tenant.name || payment.contract.tenant.email,
    amount: payment.amount,
    date: payment.createdAt,
    href: `/${locale}/dashboard/payments`,
  }))

  const quickActions = isAdmin
    ? [
        { label: 'Utilisateurs', href: `/${locale}/dashboard/users` },
        { label: 'Logs systeme', href: `/${locale}/dashboard/logs` },
        { label: 'Parametres', href: `/${locale}/dashboard/settings` },
      ]
    : [
        { label: 'Nouveau bien', href: `/${locale}/dashboard/properties/new` },
        { label: 'Nouveau bail', href: `/${locale}/dashboard/contracts/new` },
        { label: 'Paiement', href: `/${locale}/dashboard/payments/new` },
      ]

  const dashboardTitle = role === 'MANAGER' ? 'Tableau de bord manager' : 'Tableau de bord administrateur'
  const dashboardDescription = isAdmin
    ? 'Vue globale de la plateforme: revenus, occupation, contrats actifs et activite recente.'
    : 'Vue operationnelle de votre portefeuille immobilier: revenus, disponibilites et echeances.'

  return (
    <div className="space-y-6">
      <Card className="animate-fade-up overflow-hidden border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-blue-50/50 dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-blue-950/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pilotage
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
                {dashboardTitle}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {dashboardDescription}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={action.href}
                  asChild
                  variant={index === 0 ? 'default' : 'outline'}
                  size="sm"
                  className="animate-fade-up"
                >
                  <Link href={action.href}>
                    {action.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="hover-lift-soft rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Taux occupation</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{occupancyRate}%</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {propertiesCount - availableCount} biens occupes sur {propertiesCount}
              </p>
            </div>
            <div className="hover-lift-soft rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenu moyen / bien</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {averageRevenuePerProperty.toLocaleString('fr-FR')} FCFA
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Calcul sur revenus completes</p>
            </div>
            <div className="hover-lift-soft rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:col-span-2 lg:col-span-1">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Alertes contrats</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{expiringSoonCount}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Expiration dans les 30 prochains jours
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard
          title={isAdmin ? 'Revenus plateforme' : 'Mes revenus'}
          value={`${totalRevenue.toLocaleString('fr-FR')} FCFA`}
          trend={{ value: revenueGrowth, label: 'vs mois dernier' }}
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="primary"
          className="stagger-1"
        />
        <StatCard
          title={isAdmin ? 'Total biens' : 'Mes biens'}
          value={propertiesCount}
          subtitle={`${availableCount} disponibles`}
          icon={<Building className="h-5 w-5" />}
          iconBg="accent"
          className="stagger-2"
        />
        <StatCard
          title={isAdmin ? 'Total locataires' : 'Mes locataires'}
          value={tenantsCount}
          subtitle={isAdmin ? `${totalUsersCount} utilisateurs` : 'avec contrat actif'}
          icon={<Users className="h-5 w-5" />}
          iconBg="muted"
          className="stagger-3"
        />
        <StatCard
          title="Contrats actifs"
          value={activeContractsCount}
          subtitle={expiringSoonCount > 0 ? `${expiringSoonCount} expirent bientot` : 'Aucune expiration proche'}
          icon={<FileText className="h-5 w-5" />}
          iconBg={expiringSoonCount > 0 ? 'warning' : 'muted'}
          className="stagger-4"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="animate-fade-up stagger-5 xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenus (6 derniers mois)</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Tendance des paiements completes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="animate-fade-up stagger-6 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Synthese operationnelle</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Lecture rapide des signaux importants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Occupation portefeuille</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{occupancyRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Biens disponibles</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{availableCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Opportunites a louer immediatement</p>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Contrats a surveiller</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{expiringSoonCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Renouvellement a anticiper cette periode
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-up stagger-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Activite recente</CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Dernieres operations enregistrees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentActivity items={activityItems} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-fade-up stagger-5">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Performance des encaissements</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Comparaison global / mois precedent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-sm text-slate-600 dark:text-slate-300">Total cumule</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {totalRevenue.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-sm text-slate-600 dark:text-slate-300">Mois precedent</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {lastMonthRevenue.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-sm text-slate-600 dark:text-slate-300">Variation</span>
              <span
                className={`text-sm font-semibold ${revenueGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              >
                {revenueGrowth >= 0 ? '+' : '-'} {Math.abs(revenueGrowth).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up stagger-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Actions rapides</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Acces directs aux operations frequentes
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Button key={action.href} asChild variant="outline" className="justify-between">
                <Link href={action.href}>
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
