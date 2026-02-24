import Link from 'next/link'
import { Download, FileText, Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default async function ContractsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const where =
    user.role === 'ADMIN'
      ? {}
      : user.role === 'MANAGER'
        ? { property: { managerId: user.id } }
        : { tenantId: user.id }

  const contracts = await prisma.contract.findMany({
    where,
    include: { property: true, tenant: true },
    orderBy: { createdAt: 'desc' },
  })

  const withState = contracts.map((contract) => ({
    ...contract,
    viewState: resolveContractState(contract.status, contract.endDate),
  }))

  const canCreateContract = user.role === 'MANAGER'
  const canInitiatePayment = user.role === 'MANAGER' || user.role === 'TENANT'

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
            <Link href={`/${locale}/dashboard/contracts/new`}>
              <Plus className="h-4 w-4" />
              Nouveau contrat
            </Link>
          </Button>
        )}
      </header>

      {withState.length === 0 ? (
        <EmptyState
          title="Aucun contrat"
          description={
            canCreateContract
              ? 'Creez votre premier bail pour associer un bien et un locataire.'
              : 'Aucun contrat visible dans votre perimetre.'
          }
          actionLabel={canCreateContract ? 'Nouveau contrat' : undefined}
          actionHref={canCreateContract ? `/${locale}/dashboard/contracts/new` : undefined}
          icon={<FileText className="h-6 w-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {withState.map((contract) => (
            <Card key={contract.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1 text-base">Bail - {contract.property.title}</CardTitle>
                    <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                      Locataire: {contract.tenant.name || contract.tenant.email}
                    </p>
                  </div>
                  <Badge variant={statusVariant(contract.viewState)}>{contract.viewState}</Badge>
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
                  <p className="text-xs uppercase tracking-wide text-secondary dark:text-slate-400">Loyer mensuel</p>
                  <p className="text-lg font-semibold text-primary tabular-nums dark:text-slate-100">
                    {contract.rentAmount.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
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
                  {canInitiatePayment && (
                    <Button asChild size="sm" className="sm:flex-1">
                      <Link href={`/${locale}/dashboard/payments/new?contractId=${contract.id}`}>
                        Initier paiement
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
