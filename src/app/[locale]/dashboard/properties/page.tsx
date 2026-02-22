import Link from 'next/link'
import { Building, Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function statusVariant(status: string): 'success' | 'warning' | 'destructive' {
  if (status === 'AVAILABLE') return 'success'
  if (status === 'RENTED') return 'warning'
  return 'destructive'
}

function statusLabel(status: string): string {
  if (status === 'AVAILABLE') return 'Disponible'
  if (status === 'RENTED') return 'Occupe'
  if (status === 'MAINTENANCE') return 'Maintenance'
  return status
}

export default async function PropertiesPage(props: {
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

  const where = user.role === 'ADMIN' ? {} : { managerId: user.id }
  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const isManager = user.role === 'MANAGER'

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Biens immobiliers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vue globale des biens, statuts de location et disponibilites.
          </p>
        </div>
        {isManager && (
          <Button asChild>
            <Link href={`/${locale}/dashboard/properties/new`}>
              <Plus className="h-4 w-4" />
              Ajouter un bien
            </Link>
          </Button>
        )}
      </header>

      {properties.length === 0 ? (
        <EmptyState
          title="Aucun bien trouve"
          description={
            isManager
              ? 'Commencez par ajouter votre premier bien pour suivre vos locations.'
              : 'Aucun bien visible dans votre perimetre administrateur.'
          }
          actionLabel={isManager ? 'Ajouter un bien' : undefined}
          actionHref={isManager ? `/${locale}/dashboard/properties/new` : undefined}
          icon={<Building className="h-6 w-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1 text-base">{property.title}</CardTitle>
                  <Badge variant={statusVariant(property.status)}>{statusLabel(property.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                  {property.price.toLocaleString('fr-FR')} FCFA
                </p>
                <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{property.address}</p>
                {property.description ? (
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    {property.description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aucune description.</p>
                )}
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cree le {property.createdAt.toLocaleDateString('fr-FR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
