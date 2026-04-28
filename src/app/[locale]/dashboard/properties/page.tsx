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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ServerPager } from '@/components/dashboard/ServerPager'
import { buildPageHref, normalizeEnum, normalizePage, normalizeText } from '@/lib/dashboard-list-query'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 12

type PropertiesSearchParams = {
  page?: string | string[]
  q?: string | string[]
  status?: string | string[]
  city?: string | string[]
  offerType?: string | string[]
}

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

function offerTypeLabel(offerType: string): string {
  if (offerType === 'SALE') return 'Vente'
  return 'Location'
}

export default async function PropertiesPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<PropertiesSearchParams>
}) {
  const { locale } = await props.params
  const searchParams = await props.searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (user.role === 'TENANT') {
    forbidden()
  }

  const page = normalizePage(searchParams.page)
  const query = normalizeText(searchParams.q)
  const city = normalizeText(searchParams.city)
  const status = normalizeEnum(searchParams.status, ['AVAILABLE', 'RENTED', 'MAINTENANCE'])
  const offerType = normalizeEnum(searchParams.offerType, ['RENT', 'SALE'])

  const baseWhere: Prisma.PropertyWhereInput = user.role === 'ADMIN' ? {} : { managerId: user.id }
  const andFilters: Prisma.PropertyWhereInput[] = []

  if (query) {
    andFilters.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } },
      ],
    })
  }

  if (city) {
    andFilters.push({ city: { contains: city, mode: 'insensitive' } })
  }

  if (status) {
    andFilters.push({ status })
  }

  if (offerType) {
    andFilters.push({ offerType })
  }

  const where: Prisma.PropertyWhereInput =
    andFilters.length > 0 ? { ...baseWhere, AND: andFilters } : baseWhere

  const totalProperties = await prisma.property.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalProperties / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    skip: (clampedPage - 1) * PAGE_SIZE,
  })

  const isManager = user.role === 'MANAGER'
  const hasActiveFilters = Boolean(query || city || status || offerType)
  const basePath = `/${locale}/dashboard/properties`
  const buildHref = (targetPage: number) =>
    buildPageHref(basePath, { q: query, city, status, offerType }, targetPage)

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

      <Card>
        <CardContent className="pt-6">
          <form className="grid grid-cols-1 gap-4 md:grid-cols-5" method="get">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="properties-q">Recherche</Label>
              <Input
                id="properties-q"
                name="q"
                defaultValue={query}
                placeholder="Titre, adresse, description..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="properties-city">Ville</Label>
              <Input id="properties-city" name="city" defaultValue={city} placeholder="Cotonou" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="properties-status">Statut</Label>
              <select
                id="properties-status"
                name="status"
                defaultValue={status || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Tous</option>
                <option value="AVAILABLE">Disponible</option>
                <option value="RENTED">Occupe</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="properties-offerType">Offre</Label>
              <select
                id="properties-offerType"
                name="offerType"
                defaultValue={offerType || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Toutes</option>
                <option value="RENT">Location</option>
                <option value="SALE">Vente</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-5">
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

      {properties.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'Aucun resultat' : 'Aucun bien trouve'}
          description={
            hasActiveFilters
              ? 'Aucun bien ne correspond a vos filtres actuels.'
              : isManager
              ? 'Commencez par ajouter votre premier bien pour suivre vos locations.'
              : 'Aucun bien visible dans votre perimetre administrateur.'
          }
          actionLabel={isManager ? 'Ajouter un bien' : undefined}
          actionHref={isManager ? `/${locale}/dashboard/properties/new` : undefined}
          icon={<Building className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {properties.map((property) => (
              <Card key={property.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-1 text-base">{property.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{offerTypeLabel(property.offerType)}</Badge>
                      <Badge variant={statusVariant(property.status)}>{statusLabel(property.status)}</Badge>
                    </div>
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
                  <div className="flex items-center gap-2 pt-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/${locale}/marketplace/${property.id}`} target="_blank">
                        Voir
                      </Link>
                    </Button>
                    <Button asChild variant="default" size="sm" className="flex-1">
                      <Link href={`/${locale}/dashboard/properties/${property.id}`}>
                        Modifier
                      </Link>
                    </Button>
                  </div>
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
