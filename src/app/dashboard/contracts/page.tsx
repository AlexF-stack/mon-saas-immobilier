import Link from 'next/link'
import { CalendarRange, Download, FileText, Plus, Wallet } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatCard } from '@/components/ui/stat-card'
import { ServerPager } from '@/components/dashboard/ServerPager'
import { buildPageHref, normalizeEnum, normalizePage, normalizeText } from '@/lib/dashboard-list-query'
import { ManualReminderButton } from '@/components/dashboard/contracts/ManualReminderButton'
import { ContractLifecycleActions } from '@/components/dashboard/contracts/ContractLifecycleActions'

const PAGE_SIZE = 10

type ContractsSearchParams = {
  page?: string | string[]
  q?: string | string[]
  status?: string | string[]
}

function resolveContractState(status: string, endDate: Date): string {
  if (status === 'TERMINATED') return 'TERMINE'
  if (status === 'EXPIRED' || endDate < new Date()) return 'EXPIRE'
  return 'ACTIF'
}

function statusVariant(state: string): 'success' | 'warning' | 'outline' {
  if (state === 'ACTIF') return 'success'
  if (state === 'EXPIRE') return 'warning'
  return 'outline'
}

function workflowBadgeLabel(state: string): string {
  if (state === 'DRAFT') return 'Brouillon'
  if (state === 'SUBMITTED') return 'Soumis'
  if (state === 'SIGNED_BOTH') return 'Signe'
  if (state === 'PAYMENT_INITIATED') return 'Paiement initie'
  if (state === 'ACTIVE') return 'Actif'
  return state
}

export default async function ContractsPage(props: { searchParams: Promise<ContractsSearchParams> }) {
  const searchParams = await props.searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect('/login')
  }

  const page = normalizePage(searchParams.page)
  const query = normalizeText(searchParams.q)
  const status = normalizeEnum(searchParams.status, ['ACTIVE', 'EXPIRED', 'TERMINATED'])

  const baseWhere: Prisma.ContractWhereInput =
    user.role === 'ADMIN'
      ? {}
      : user.role === 'MANAGER'
        ? { property: { managerId: user.id } }
        : { tenantId: user.id }

  const andFilters: Prisma.ContractWhereInput[] = []
  if (query) {
    andFilters.push({
      OR: [
        { property: { title: { contains: query, mode: 'insensitive' } } },
        { tenant: { name: { contains: query, mode: 'insensitive' } } },
        { tenant: { email: { contains: query, mode: 'insensitive' } } },
      ],
    })
  }
  if (status) andFilters.push({ status })

  const where: Prisma.ContractWhereInput =
    andFilters.length > 0 ? { ...baseWhere, AND: andFilters } : baseWhere

  const totalContracts = await prisma.contract.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalContracts / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  const contracts = await prisma.contract.findMany({
    where,
    include: { property: true, tenant: true },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    skip: (clampedPage - 1) * PAGE_SIZE,
  })

  const withState = contracts.map((contract) => ({
    ...contract,
    viewState: resolveContractState(contract.status, contract.endDate),
  }))

  const now = new Date()
  const [allContractsCount, activeContracts, expiredContracts, totalRent] = await Promise.all([
    prisma.contract.count({ where: baseWhere }),
    prisma.contract.count({
      where: { ...baseWhere, status: 'ACTIVE', endDate: { gte: now } },
    }),
    prisma.contract.count({
      where: {
        ...baseWhere,
        OR: [{ status: 'EXPIRED' }, { endDate: { lt: now } }],
      },
    }),
    prisma.contract.aggregate({
      where: { ...baseWhere, status: 'ACTIVE', endDate: { gte: now } },
      _sum: { rentAmount: true },
    }),
  ])

  const canCreateContract = user.role === 'MANAGER'
  const canInitiatePayment = user.role === 'MANAGER' || user.role === 'TENANT'
  const canSendManualReminder = user.role === 'MANAGER'
  const hasActiveFilters = Boolean(query || status)
  const basePath = '/dashboard/contracts'
  const buildHref = (targetPage: number) => buildPageHref(basePath, { q: query, status }, targetPage)

  const formatDate = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contrats</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivi des baux, loyers et statuts de validite.
          </p>
        </div>
        {canCreateContract && (
          <Button asChild>
            <Link href="/dashboard/contracts/new">
              <Plus className="h-4 w-4" />
              Nouveau contrat
            </Link>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard
          title="Total baux"
          value={allContractsCount}
          subtitle="Tous statuts"
          icon={<FileText className="h-5 w-5" />}
          iconBg="primary"
        />
        <StatCard
          title="Actifs"
          value={activeContracts}
          subtitle="En cours"
          icon={<CalendarRange className="h-5 w-5" />}
          iconBg="success"
        />
        <StatCard
          title="Expires"
          value={expiredContracts}
          subtitle="A renouveler"
          icon={<CalendarRange className="h-5 w-5" />}
          iconBg={expiredContracts > 0 ? 'warning' : 'muted'}
        />
        <StatCard
          title="Loyers actifs"
          value={`${(totalRent._sum.rentAmount ?? 0).toLocaleString('fr-FR')} FCFA`}
          subtitle="Mensuel cumule"
          icon={<Wallet className="h-5 w-5" />}
          iconBg="accent"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contracts-q">Recherche</Label>
              <Input
                id="contracts-q"
                name="q"
                defaultValue={query}
                placeholder="Bien, nom locataire, email..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contracts-status">Statut</Label>
              <select
                id="contracts-status"
                name="status"
                defaultValue={status || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Tous</option>
                <option value="ACTIVE">Actif</option>
                <option value="EXPIRED">Expire</option>
                <option value="TERMINATED">Termine</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Filtrer
                </Button>
                {hasActiveFilters ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={basePath}>Reinitialiser</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {withState.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'Aucun resultat' : 'Aucun contrat'}
          description={
            hasActiveFilters
              ? 'Aucun contrat ne correspond a vos filtres actuels.'
              : canCreateContract
                ? 'Creez votre premier bail pour associer un bien et un locataire.'
                : 'Aucun contrat visible dans votre perimetre.'
          }
          actionLabel={canCreateContract ? 'Nouveau contrat' : undefined}
          actionHref={canCreateContract ? '/dashboard/contracts/new' : undefined}
          icon={<FileText className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {withState.map((contract) => (
              <Card key={contract.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="line-clamp-1 text-base">
                        {contract.contractType === 'SALE' ? 'Contrat de vente' : 'Contrat de location'} -{' '}
                        {contract.property.title}
                      </CardTitle>
                      <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                        Locataire: {contract.tenant.name || contract.tenant.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(contract.viewState)}>{contract.viewState}</Badge>
                      <Badge variant="outline">{workflowBadgeLabel(contract.workflowState)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-secondary dark:text-slate-400">Debut</p>
                      <p className="font-medium text-primary dark:text-slate-100">{formatDate(contract.startDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-secondary dark:text-slate-400">Fin</p>
                      <p className="font-medium text-primary dark:text-slate-100">{formatDate(contract.endDate)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="text-xs uppercase tracking-wide text-secondary dark:text-slate-400">
                      {contract.contractType === 'SALE' ? 'Montant contractuel' : 'Loyer mensuel'}
                    </p>
                    <p className="text-lg font-semibold text-primary tabular-nums dark:text-slate-100">
                      {contract.rentAmount.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <ContractLifecycleActions
                    contractId={contract.id}
                    contractType={contract.contractType}
                    workflowState={contract.workflowState}
                    documentSource={contract.documentSource}
                    fileUrl={contract.fileUrl}
                    contractText={contract.contractText}
                    receiptFileUrl={contract.receiptFileUrl}
                    receiptText={contract.receiptText}
                    submittedAt={contract.submittedAt ? contract.submittedAt.toISOString() : null}
                    ownerSignedAt={contract.ownerSignedAt ? contract.ownerSignedAt.toISOString() : null}
                    tenantSignedAt={contract.tenantSignedAt ? contract.tenantSignedAt.toISOString() : null}
                    canManage={user.role === 'ADMIN' || (user.role === 'MANAGER' && contract.property.managerId === user.id)}
                    canSign={
                      (user.role === 'ADMIN' || (user.role === 'MANAGER' && contract.property.managerId === user.id))
                        ? !contract.ownerSignedAt
                        : user.role === 'TENANT' && contract.tenantId === user.id && !contract.tenantSignedAt
                    }
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" size="sm" className="sm:flex-1">
                      <a
                        href={`/api/contracts/${contract.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4" />
                        Telecharger PDF
                      </a>
                    </Button>
                    {canInitiatePayment &&
                      (contract.workflowState === 'SIGNED_BOTH' ||
                        contract.workflowState === 'PAYMENT_INITIATED' ||
                        contract.workflowState === 'ACTIVE') && (
                      <Button asChild size="sm" className="sm:flex-1">
                        <Link href={`/dashboard/payments/new?contractId=${contract.id}`}>Initier paiement</Link>
                      </Button>
                      )}
                  </div>
                  {canSendManualReminder ? (
                    <ManualReminderButton contractId={contract.id} />
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
          <ServerPager page={clampedPage} totalPages={totalPages} buildHref={buildHref} />
        </div>
      )}
    </section>
  )
}
