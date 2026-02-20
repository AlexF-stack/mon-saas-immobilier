import Link from 'next/link'
import { Plus, ShieldAlert, UserCheck, Users } from 'lucide-react'
import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'

export default async function TenantsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'TENANT') {
    forbidden()
  }

  const whereClause =
    user.role === 'ADMIN'
      ? { role: 'TENANT' as const }
      : {
          role: 'TENANT' as const,
          contracts: {
            some: {
              property: { managerId: user.id },
            },
          },
        }

  const tenants = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  })

  const totalTenants = tenants.length
  const suspendedCount = tenants.filter((tenant) => tenant.isSuspended).length
  const activeCount = totalTenants - suspendedCount
  const canCreateTenant = user.role === 'ADMIN' || user.role === 'MANAGER'

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Locataires</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gestion des comptes locataires et de leur etat d acces.
          </p>
        </div>
        {canCreateTenant && (
          <Button asChild>
            <Link href="/dashboard/tenants/new">
              <Plus className="h-4 w-4" />
              Ajouter un locataire
            </Link>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          title="Total locataires"
          value={totalTenants}
          subtitle="Dans votre perimetre"
          icon={<Users className="h-5 w-5" />}
          iconBg="primary"
        />
        <StatCard
          title="Comptes actifs"
          value={activeCount}
          subtitle="Peuvent se connecter"
          icon={<UserCheck className="h-5 w-5" />}
          iconBg="success"
        />
        <StatCard
          title="Suspendus"
          value={suspendedCount}
          subtitle="Acces bloque"
          icon={<ShieldAlert className="h-5 w-5" />}
          iconBg={suspendedCount > 0 ? 'warning' : 'muted'}
        />
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Aucun locataire trouve"
          description="Aucun locataire visible dans votre perimetre."
          actionLabel={canCreateTenant ? 'Ajouter un locataire' : undefined}
          actionHref={canCreateTenant ? '/dashboard/tenants/new' : undefined}
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0 border border-slate-200 dark:border-slate-700">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tenant.email)}`}
                      />
                      <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {tenant.name?.slice(0, 2).toUpperCase() || 'LO'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="line-clamp-1 text-base">{tenant.name || 'Sans nom'}</CardTitle>
                      <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{tenant.email}</p>
                    </div>
                  </div>
                  <Badge variant={tenant.isSuspended ? 'warning' : 'success'}>
                    {tenant.isSuspended ? 'Suspendu' : 'Actif'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Inscrit le {tenant.createdAt.toLocaleDateString('fr-FR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
