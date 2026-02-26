import Link from 'next/link'
import { Download, Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaymentsTable } from '@/components/dashboard/PaymentsTable'
import { WithdrawPanel } from '@/components/dashboard/WithdrawPanel'
import { ServerPager } from '@/components/dashboard/ServerPager'
import { buildPageHref, normalizeEnum, normalizePage, normalizeText } from '@/lib/dashboard-list-query'
import {
  getLatestWithdrawalRecords,
  sumPaidWithdrawals,
  sumReservedWithdrawals,
  WITHDRAWAL_ACTION,
  WITHDRAWAL_TARGET_TYPE,
} from '@/lib/withdrawals'

const PAGE_SIZE = 10

type PaymentsSearchParams = {
  page?: string | string[]
  q?: string | string[]
  status?: string | string[]
  method?: string | string[]
  from?: string | string[]
  to?: string | string[]
}

function normalizeDateInput(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return ''
  return trimmed
}

function buildPaymentsExportHref(filters: {
  q?: string
  status?: string | null
  method?: string | null
  from?: string
  to?: string
  format: 'csv' | 'xlsx'
}): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  if (filters.method) params.set('method', filters.method)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  params.set('format', filters.format)
  return `/api/payments/export?${params.toString()}`
}

export default async function PaymentsPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<PaymentsSearchParams>
}) {
  const { locale } = await props.params
  const searchParams = await props.searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const role = user.role
  const userId = user.id

  const page = normalizePage(searchParams.page)
  const query = normalizeText(searchParams.q)
  const status = normalizeEnum(searchParams.status, ['COMPLETED', 'PENDING', 'FAILED'])
  const method = normalizeEnum(searchParams.method, ['MOMO_MTN', 'MOOV', 'CASH'])
  const from = normalizeDateInput(searchParams.from)
  const to = normalizeDateInput(searchParams.to)
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null

  const scopeWhere: Prisma.PaymentWhereInput =
    role === 'MANAGER'
      ? { contract: { property: { managerId: userId } } }
      : role === 'TENANT'
        ? { contract: { tenantId: userId } }
        : {}

  const andFilters: Prisma.PaymentWhereInput[] = []
  if (status) andFilters.push({ status })
  if (method) andFilters.push({ method })
  if (query) {
    andFilters.push({
      OR: [
        { transactionId: { contains: query, mode: 'insensitive' } },
        { method: { contains: query, mode: 'insensitive' } },
        { contract: { property: { title: { contains: query, mode: 'insensitive' } } } },
        { contract: { tenant: { name: { contains: query, mode: 'insensitive' } } } },
        { contract: { tenant: { email: { contains: query, mode: 'insensitive' } } } },
      ],
    })
  }
  if (fromDate || toDate) {
    andFilters.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    })
  }

  const tableWhere: Prisma.PaymentWhereInput =
    andFilters.length > 0 ? { ...scopeWhere, AND: andFilters } : scopeWhere

  const [totalPayments, grossRevenue] = await Promise.all([
    prisma.payment.count({ where: tableWhere }),
    prisma.payment.aggregate({
      where: { ...scopeWhere, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(totalPayments / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pagedPayments = await prisma.payment.findMany({
    where: tableWhere,
    orderBy: { createdAt: 'desc' },
    include: { contract: { include: { property: true, tenant: true } } },
    take: PAGE_SIZE,
    skip: (clampedPage - 1) * PAGE_SIZE,
  })

  const totalRevenue = grossRevenue._sum.amount ?? 0
  const canCreatePayment = role === 'MANAGER' || role === 'TENANT'
  const canWithdraw = role === 'ADMIN' || role === 'MANAGER'

  const withdrawalLogs = canWithdraw
    ? await prisma.systemLog.findMany({
        where: {
          action: WITHDRAWAL_ACTION,
          targetType: WITHDRAWAL_TARGET_TYPE,
          ...(role === 'ADMIN' ? {} : { actorId: userId }),
        },
        orderBy: { createdAt: 'desc' },
        take: role === 'ADMIN' ? 400 : 120,
        select: {
          id: true,
          actorId: true,
          actorEmail: true,
          actorRole: true,
          targetId: true,
          details: true,
          createdAt: true,
        },
      })
    : []

  const allWithdrawalRecords = getLatestWithdrawalRecords(withdrawalLogs)
  const ownWithdrawalRecords =
    role === 'ADMIN'
      ? allWithdrawalRecords.filter((record) => record.actorId === userId)
      : allWithdrawalRecords

  const reservedTotal = sumReservedWithdrawals(ownWithdrawalRecords)
  const paidTotal = sumPaidWithdrawals(ownWithdrawalRecords)
  const availableBalance = Math.max(0, totalRevenue - reservedTotal)
  const recentWithdrawals = ownWithdrawalRecords.slice(0, 8).map((item) => ({
    ...item,
    requestedAt: item.requestedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  const reviewQueue =
    role === 'ADMIN'
      ? allWithdrawalRecords
          .filter(
            (record) =>
              record.actorRole === 'MANAGER' &&
              (record.status === 'REQUESTED' || record.status === 'APPROVED')
          )
          .slice(0, 20)
          .map((item) => ({
            ...item,
            requestedAt: item.requestedAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))
      : []

  const rows = pagedPayments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    transactionId: payment.transactionId,
    createdAt: payment.createdAt.toISOString(),
    propertyTitle: payment.contract.property.title,
    tenantName: payment.contract.tenant.name || payment.contract.tenant.email,
  }))

  const hasActiveFilters = Boolean(query || status || method || from || to)
  const basePath = `/${locale}/dashboard/payments`
  const buildHref = (targetPage: number) =>
    buildPageHref(basePath, { q: query, status, method, from, to }, targetPage)
  const csvExportHref = buildPaymentsExportHref({ q: query, status, method, from, to, format: 'csv' })
  const xlsxExportHref = buildPaymentsExportHref({ q: query, status, method, from, to, format: 'xlsx' })

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paiements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivi des encaissements, statuts de transaction et quittances.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={csvExportHref}>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={xlsxExportHref}>
              <Download className="h-4 w-4" />
              Export XLSX
            </a>
          </Button>
          {canCreatePayment && (
            <Button asChild>
              <Link href={`/${locale}/dashboard/payments/new`}>
                <Plus className="h-4 w-4" />
                Nouveau paiement
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payments-q">Recherche</Label>
              <Input
                id="payments-q"
                name="q"
                defaultValue={query}
                placeholder="Bien, locataire, transaction..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payments-status">Statut</Label>
              <select
                id="payments-status"
                name="status"
                defaultValue={status || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Tous</option>
                <option value="COMPLETED">Paye</option>
                <option value="PENDING">En attente</option>
                <option value="FAILED">Echoue</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payments-method">Methode</Label>
              <select
                id="payments-method"
                name="method"
                defaultValue={method || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Toutes</option>
                <option value="MOMO_MTN">MTN MoMo</option>
                <option value="MOOV">Moov Money</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payments-from">Du</Label>
              <Input id="payments-from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payments-to">Au</Label>
              <Input id="payments-to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex items-center gap-2 md:col-span-6">
              <Button type="submit" size="sm">
                Filtrer
              </Button>
              {hasActiveFilters ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={basePath}>Reinitialiser</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <PaymentsTable payments={rows} />
      <ServerPager page={clampedPage} totalPages={totalPages} buildHref={buildHref} />

      {canWithdraw ? (
        <WithdrawPanel
          availableBalance={availableBalance}
          reservedTotal={reservedTotal}
          paidTotal={paidTotal}
          recentWithdrawals={recentWithdrawals}
          reviewQueue={reviewQueue}
          isAdmin={role === 'ADMIN'}
        />
      ) : null}
    </section>
  )
}
