import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { verifyAuth, isUserRole } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserAdminActions } from '@/components/dashboard/UserAdminActions'

export default async function UsersPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const session = token ? await verifyAuth(token) : null

    if (!session || session.role !== 'ADMIN') {
        redirect('/dashboard')
    }

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
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

    return (
        <div className="space-y-4 sm:space-y-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Utilisateurs de la Plateforme</h1>

            <div className="grid gap-3 sm:gap-4">
                {users.map((user) => {
                    const roleForActions = isUserRole(user.role) ? user.role : null
                    return (
                        <Card key={user.id} className="min-w-0 overflow-hidden">
                            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
                                <CardTitle className="text-sm font-medium truncate">
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
        </div>
    )
}
