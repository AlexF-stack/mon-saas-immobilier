import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { BadgeCheck, BarChart3, Building2, RotateCcw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KpiCards, type KpiTotals } from '@/components/admin/KpiCards'
import { KpiChart, type KpiChartPoint } from '@/components/admin/KpiChart'

const RANGE_OPTIONS = [7, 30, 90] as const
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type AnalyticsSearchParams = {
  range?: string | string[]
  rebuilt?: string | string[]
  rebuildError?: string | string[]
}

type DailyKpiRow = {
  date: Date
  signups: number
  contracts: number
  payments: number
  withdrawalCount: number
  withdrawalVolume: number
  grossVolume: number
  netCashFlow: number
}

type DailyKpiPoint = {
  date: string
  signups: number
  contracts: number
  payments: number
  withdrawalCount: number
  withdrawalVolume: number
  grossVolume: number
  netCashFlow: number
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function normalizeRange(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstValue(value), 10)
  return RANGE_OPTIONS.includes(parsed as (typeof RANGE_OPTIONS)[number]) ? parsed : 30
}

function toUtcDayStart(input: Date): Date {
  const date = new Date(input)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcDays(input: Date, days: number): Date {
  const next = new Date(input)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseCalendarDate(value: string): Date | null {
  if (!DATE_REGEX.test(value)) return null
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sumTotals(points: DailyKpiPoint[]): KpiTotals {
  return points.reduce(
    (acc, item) => ({
      signups: acc.signups + item.signups,
      contracts: acc.contracts + item.contracts,
      grossVolume: acc.grossVolume + item.grossVolume,
      withdrawalVolume: acc.withdrawalVolume + item.withdrawalVolume,
      netCashFlow: acc.netCashFlow + item.netCashFlow,
    }),
    {
      signups: 0,
      contracts: 0,
      grossVolume: 0,
      withdrawalVolume: 0,
      netCashFlow: 0,
    }
  )
}

function buildSeries(start: Date, end: Date, byDate: Map<string, DailyKpiRow>): DailyKpiPoint[] {
  const points: DailyKpiPoint[] = []
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const key = formatUtcDate(cursor)
    const row = byDate.get(key)
    points.push({
      date: key,
      signups: row ? toNumber(row.signups) : 0,
      contracts: row ? toNumber(row.contracts) : 0,
      payments: row ? toNumber(row.payments) : 0,
      withdrawalCount: row ? toNumber(row.withdrawalCount) : 0,
      withdrawalVolume: row ? toNumber(row.withdrawalVolume) : 0,
      grossVolume: row ? toNumber(row.grossVolume) : 0,
      netCashFlow: row ? toNumber(row.netCashFlow) : 0,
    })
  }
  return points
}

function toChartData(points: DailyKpiPoint[]): KpiChartPoint[] {
  return points.map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`)
    return {
      date: point.date,
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      grossVolume: point.grossVolume,
      netCashFlow: point.netCashFlow,
    }
  })
}

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-FR')} FCFA`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

function normalizeProvider(method: string) {
  const value = method.trim().toUpperCase()
  if (value.includes('MTN')) return 'MTN MoMo'
  if (value.includes('MOOV')) return 'Moov Money'
  return 'Autres'
}

function getDueDay(contractStartDate: Date, paymentDate: Date) {
  const contractDueDay = contractStartDate.getUTCDate()
  const lastDayOfMonth = new Date(
    Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth() + 1, 0)
  ).getUTCDate()
  return Math.min(contractDueDay, lastDayOfMonth)
}

export default async function DashboardAnalyticsPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<AnalyticsSearchParams>
}) {
  const { locale } = await props.params
  const searchParams = await props.searchParams
  const selectedRange = normalizeRange(searchParams.range)
  const showRebuilt = firstValue(searchParams.rebuilt) === '1'
  const showRebuildError = firstValue(searchParams.rebuildError) === '1'

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (user.role !== 'ADMIN') {
    redirect(`/${locale}/forbidden`)
  }

  const todayUtc = toUtcDayStart(new Date())
  const currentEnd = addUtcDays(todayUtc, -1)
  const currentStart = addUtcDays(currentEnd, -(selectedRange - 1))
  const previousEnd = addUtcDays(currentStart, -1)
  const previousStart = addUtcDays(previousEnd, -(selectedRange - 1))

  const queryEnd = addUtcDays(currentEnd, 1)
  const rows = await prisma.$queryRaw<DailyKpiRow[]>`
      SELECT
        "date",
        "signups",
        "contracts",
        "payments",
        "withdrawalCount",
        "withdrawalVolume",
        "grossVolume",
        "netCashFlow"
      FROM "DailyKPI"
      WHERE "date" >= ${previousStart} AND "date" < ${queryEnd}
      ORDER BY "date" ASC
    `

  const byDate = new Map(rows.map((row) => [formatUtcDate(new Date(row.date)), row] as const))
  const currentSeries = buildSeries(currentStart, currentEnd, byDate)
  const previousSeries = buildSeries(previousStart, previousEnd, byDate)

  const currentTotals = sumTotals(currentSeries)
  const previousTotals = sumTotals(previousSeries)
  const chartData = toChartData(currentSeries)

  const [activePropertiesCount, occupiedPropertiesCount, rentPayments, providerGroups] = await Promise.all([
    prisma.property.count({
      where: {
        status: { in: ['AVAILABLE', 'RENTED'] },
      },
    }),
    prisma.property.count({
      where: { status: 'RENTED' },
    }),
    prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        type: 'RENT',
        createdAt: { gte: currentStart, lt: queryEnd },
      },
      select: {
        createdAt: true,
        contract: {
          select: {
            startDate: true,
          },
        },
      },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: {
        status: 'COMPLETED',
        createdAt: { gte: currentStart, lt: queryEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const occupancyRate = safeRate(occupiedPropertiesCount, activePropertiesCount)
  const conversionSignupToContract = safeRate(currentTotals.contracts, currentTotals.signups)

  const onTimePayments = rentPayments.filter((payment) => {
    const paymentDate = new Date(payment.createdAt)
    const dueDay = getDueDay(new Date(payment.contract.startDate), paymentDate)
    return paymentDate.getUTCDate() <= dueDay
  }).length
  const onTimePaymentRate = safeRate(onTimePayments, rentPayments.length)

  const providerSummary = providerGroups.reduce(
    (acc, entry) => {
      const provider = normalizeProvider(entry.method)
      const amount = Number(entry._sum.amount ?? 0)
      const count = Number(entry._count._all ?? 0)

      if (provider === 'MTN MoMo') {
        acc.mtn.volume += amount
        acc.mtn.count += count
      } else if (provider === 'Moov Money') {
        acc.moov.volume += amount
        acc.moov.count += count
      } else {
        acc.other.volume += amount
        acc.other.count += count
      }
      return acc
    },
    {
      mtn: { volume: 0, count: 0 },
      moov: { volume: 0, count: 0 },
      other: { volume: 0, count: 0 },
    }
  )

  const mobileMoneyVolume = providerSummary.mtn.volume + providerSummary.moov.volume
  const mobileMoneyCount = providerSummary.mtn.count + providerSummary.moov.count
  const mobileMoneyShare = safeRate(mobileMoneyVolume, currentTotals.grossVolume)
  const providerRows = [
    {
      name: 'MTN MoMo',
      count: providerSummary.mtn.count,
      volume: providerSummary.mtn.volume,
      share: safeRate(providerSummary.mtn.volume, currentTotals.grossVolume),
      badge: 'default' as const,
    },
    {
      name: 'Moov Money',
      count: providerSummary.moov.count,
      volume: providerSummary.moov.volume,
      share: safeRate(providerSummary.moov.volume, currentTotals.grossVolume),
      badge: 'warning' as const,
    },
    {
      name: 'Autres',
      count: providerSummary.other.count,
      volume: providerSummary.other.volume,
      share: safeRate(providerSummary.other.volume, currentTotals.grossVolume),
      badge: 'secondary' as const,
    },
  ]

  const securityControls = [
    {
      label: 'Internal rebuild key',
      enabled: Boolean(process.env.INTERNAL_API_KEY?.trim()),
      detail: 'INTERNAL_API_KEY',
    },
    {
      label: 'Cron bearer token',
      enabled: Boolean(process.env.CRON_SECRET?.trim()),
      detail: 'CRON_SECRET',
    },
    {
      label: 'Server action rebuild',
      enabled: true,
      detail: 'Secret non expose client',
    },
  ]

  async function rebuildAction(formData: FormData) {
    'use server'

    const range = normalizeRange(formData.get('range')?.toString())
    const from = formData.get('from')?.toString() ?? ''
    const to = formData.get('to')?.toString() ?? ''

    const fallbackTarget = `/${locale}/dashboard/analytics?range=${range}`
    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      redirect(`${fallbackTarget}&rebuildError=1`)
    }

    const fromDate = parseCalendarDate(from)
    const toDate = parseCalendarDate(to)
    if (!fromDate || !toDate || toDate < fromDate) {
      redirect(`${fallbackTarget}&rebuildError=1`)
    }

    const store = await cookies()
    const sessionToken = store.get('token')?.value
    const session = sessionToken ? await verifyAuth(sessionToken) : null
    if (!session || session.role !== 'ADMIN') {
      redirect(`/${locale}/forbidden`)
    }

    const internalApiKey = process.env.INTERNAL_API_KEY?.trim()
    if (!internalApiKey) {
      redirect(`${fallbackTarget}&rebuildError=1`)
    }

    const requestHeaders = await headers()
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
    if (!host) {
      redirect(`${fallbackTarget}&rebuildError=1`)
    }
    const proto =
      requestHeaders.get('x-forwarded-proto') ??
      (process.env.NODE_ENV === 'development' ? 'http' : 'https')
    const baseUrl = `${proto}://${host}`

    const response = await fetch(`${baseUrl}/api/internal/kpi/rebuild`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        'x-internal-api-key': internalApiKey,
      },
      body: JSON.stringify({ from, to }),
    })

    revalidatePath(`/${locale}/dashboard/analytics`)
    if (!response.ok) {
      redirect(`${fallbackTarget}&rebuildError=1`)
    }
    redirect(`${fallbackTarget}&rebuilt=1`)
  }

  return (
    <section className="space-y-6">
      <Card className="animate-fade-up overflow-hidden border-border bg-gradient-to-r from-[rgb(var(--card))] via-[rgb(var(--surface))] to-[rgb(var(--surface)/0.7)] dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-blue-950/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary dark:text-slate-400">
                <BarChart3 className="h-3.5 w-3.5" />
                Pilotage Executif
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl dark:text-slate-100">
                Admin Analytics
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm text-secondary dark:text-slate-300">
                Vue business consolidee sur {selectedRange} jours, comparee a la periode precedente.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((range) => (
                <Button
                  key={range}
                  asChild
                  variant={range === selectedRange ? 'default' : 'outline'}
                  size="sm"
                >
                  <Link href={`/${locale}/dashboard/analytics?range=${range}`}>{range}j</Link>
                </Button>
              ))}
              <form action={rebuildAction}>
                <input type="hidden" name="from" value={formatUtcDate(currentStart)} />
                <input type="hidden" name="to" value={formatUtcDate(currentEnd)} />
                <input type="hidden" name="range" value={String(selectedRange)} />
                <Button type="submit" variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4" />
                  Rebuild
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showRebuilt ? (
        <Card className="border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardContent className="py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Rebuild KPI termine avec succes.
          </CardContent>
        </Card>
      ) : null}

      {showRebuildError ? (
        <Card className="border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/20">
          <CardContent className="py-3 text-sm text-rose-700 dark:text-rose-300">
            Le rebuild KPI a echoue. Verifiez les secrets et relancez l&apos;operation.
          </CardContent>
        </Card>
      ) : null}

      <KpiCards current={currentTotals} previous={previousTotals} />

      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Gross Volume vs Net Cash Flow</CardTitle>
          <CardDescription className="text-xs text-secondary dark:text-slate-400">
            Evolution journaliere sur la fenetre selectionnee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KpiChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4" />
              KPI Immobilier
            </CardTitle>
            <CardDescription className="text-xs text-secondary dark:text-slate-400">
              Metriques metier pour pilotage immobilier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-secondary dark:text-slate-300">Biens actifs</span>
              <span className="font-semibold text-primary dark:text-slate-100">
                {activePropertiesCount.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-secondary dark:text-slate-300">Taux d&apos;occupation</span>
              <span className="font-semibold text-primary dark:text-slate-100">{formatPercent(occupancyRate)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-secondary dark:text-slate-300">Paiements a temps</span>
              <span className="font-semibold text-primary dark:text-slate-100">
                {formatPercent(onTimePaymentRate)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <span className="text-secondary dark:text-slate-300">Conversion signup → contrat</span>
              <span className="font-semibold text-primary dark:text-slate-100">
                {formatPercent(conversionSignupToContract)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Smartphone className="h-4 w-4" />
              Mobile Money (Benin)
            </CardTitle>
            <CardDescription className="text-xs text-secondary dark:text-slate-400">
              Repartition des paiements par provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-surface/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-secondary dark:text-slate-400">
                Part Mobile Money
              </p>
              <p className="mt-1 text-xl font-semibold text-primary dark:text-slate-100">
                {formatPercent(mobileMoneyShare)}
              </p>
              <p className="mt-1 text-xs text-secondary dark:text-slate-400">
                {mobileMoneyCount.toLocaleString('fr-FR')} transactions | {formatMoney(mobileMoneyVolume)}
              </p>
            </div>
            <div className="space-y-2">
              {providerRows.map((provider) => (
                <div
                  key={provider.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={provider.badge}>{provider.name}</Badge>
                    <span className="text-xs text-secondary dark:text-slate-400">
                      {provider.count.toLocaleString('fr-FR')} tx
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary dark:text-slate-100">
                      {formatMoney(provider.volume)}
                    </p>
                    <p className="text-xs text-secondary dark:text-slate-400">{formatPercent(provider.share)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BadgeCheck className="h-4 w-4" />
              Security Controls
            </CardTitle>
            <CardDescription className="text-xs text-secondary dark:text-slate-400">
              Etat des protections internes analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityControls.map((control) => (
              <div
                key={control.label}
                className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div>
                  <p className="text-sm font-medium text-primary dark:text-slate-100">{control.label}</p>
                  <p className="text-xs text-secondary dark:text-slate-400">{control.detail}</p>
                </div>
                <Badge variant={control.enabled ? 'success' : 'destructive'}>
                  {control.enabled ? 'Enabled' : 'Missing'}
                </Badge>
              </div>
            ))}
            <div className="rounded-xl border border-border bg-card p-3 text-xs text-secondary dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              Rebuild protege par role admin + internal key + rate limit + cron bearer token.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
