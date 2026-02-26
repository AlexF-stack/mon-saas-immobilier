import Link from 'next/link'
import { cookies } from 'next/headers'
import { forbidden } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAdminActions } from '@/components/dashboard/UserAdminActions'
import { ServerPager } from '@/components/dashboard/ServerPager'
import { verifyAuth, isUserRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPageHref, normalizeEnum, normalizePage, normalizeText } from '@/lib/dashboard-list-query'

const PAGE_SIZE = 20

type UsersSearchParams = {
  page?: string | string[]
  q?: string | string[]
  role?: string | string[]
  suspended?: string | string[]
}

export default async function UsersPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<UsersSearchParams>
}) {
  const { locale } = await props.params
  const searchParams = await props.searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const session = token ? await verifyAuth(token) : null

  if (!session || session.role !== 'ADMIN') {
    forbidden()
  }

  const page = normalizePage(searchParams.page)
  const query = normalizeText(searchParams.q)
  const role = normalizeEnum(searchParams.role, ['ADMIN', 'MANAGER', 'TENANT'])
  const suspended = normalizeEnum(searchParams.suspended, ['ONLY', 'ACTIVE'])

  const andFilters: Prisma.UserWhereInput[] = []
  if (query) {
    andFilters.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    })
  }
  if (role) andFilters.push({ role })
  if (suspended === 'ONLY') andFilters.push({ isSuspended: true })
  if (suspended === 'ACTIVE') andFilters.push({ isSuspended: false })

  const where: Prisma.UserWhereInput = andFilters.length > 0 ? { AND: andFilters } : {}
  const totalUsers = await prisma.user.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    skip: (clampedPage - 1) * PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuspended: true,
      suspendedAt: true,
      createdAt: true,
      _count: {
        select: {
          managedProperties: true,
          contracts: true,
        },
      },
    },
  })

  const hasActiveFilters = Boolean(query || role || suspended)
  const basePath = `/${locale}/dashboard/users`
  const buildHref = (targetPage: number) =>
    buildPageHref(basePath, { q: query, role, suspended }, targetPage)

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Utilisateurs de la Plateforme</h1>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="users-q">Recherche</Label>
              <Input id="users-q" name="q" defaultValue={query} placeholder="Nom ou email..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-role">Role</Label>
              <select
                id="users-role"
                name="role"
                defaultValue={role || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Tous</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="TENANT">TENANT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-suspended">Statut</Label>
              <select
                id="users-suspended"
                name="suspended"
                defaultValue={suspended || ''}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
              >
                <option value="">Tous</option>
                <option value="ACTIVE">Actifs</option>
                <option value="ONLY">Suspendus</option>
              </select>
            </div>
            <div className="flex items-center gap-2 md:col-span-4">
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

      <div className="grid gap-3 sm:gap-4">
        {users.map((user) => {
          const roleForActions = isUserRole(user.role) ? user.role : null
          return (
            <Card key={user.id} className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="truncate text-sm font-medium">
                  {user.name || 'Sans nom'} ({user.email})
                </CardTitle>
                <div className="flex gap-2">
                  <Badge
                    variant={
                      user.role === 'ADMIN'
                        ? 'destructive'
                        : user.role === 'MANAGER'
                          ? 'default'
                          : 'secondary'
                    }
                    className="w-fit shrink-0"
                  >
                    {user.role}
                  </Badge>
                  {user.isSuspended && (
                    <Badge variant="outline" className="w-fit shrink-0">
                      SUSPENDED
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <p>Inscrit le : {new Date(user.createdAt).toLocaleDateString('fr-FR')}</p>
                  {user.isSuspended && user.suspendedAt && (
                    <p>Suspendu le : {new Date(user.suspendedAt).toLocaleDateString('fr-FR')}</p>
                  )}
                  {user.role === 'MANAGER' && <p>Biens geres : {user._count.managedProperties}</p>}
                  {user.role === 'TENANT' && <p>Contrats actifs : {user._count.contracts}</p>}
                </div>
                {roleForActions ? (
                  <UserAdminActions
                    userId={user.id}
                    currentUserId={session.id}
                    currentRole={roleForActions}
                    isSuspended={user.isSuspended}
                  />
                ) : (
                  <p className="text-xs text-destructive">Role invalide detecte en base.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ServerPager page={clampedPage} totalPages={totalPages} buildHref={buildHref} />
    </div>
  )
}
