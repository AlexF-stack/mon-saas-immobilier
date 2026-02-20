import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth'
import { forbidden } from 'next/navigation'

export default async function LogsPage(props: {
    params: Promise<{ locale: string }>
}) {
    await props.params
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const session = token ? await verifyAuth(token) : null

    if (!session || session.role !== 'ADMIN') {
        forbidden()
    }

    const logs = await prisma.systemLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 150,
    })

    return (
        <div className="space-y-4 sm:space-y-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Logs Systeme</h1>

            <div className="grid gap-3 sm:gap-4">
                {logs.map((log) => (
                    <Card key={log.id} className="min-w-0 overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="text-sm font-medium">{log.action}</CardTitle>
                                <Badge variant="outline">{log.targetType}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-1">
                            <p>Date : {new Date(log.createdAt).toLocaleString('fr-FR')}</p>
                            <p>Acteur : {log.actorEmail || 'system'} ({log.actorRole || 'N/A'})</p>
                            {log.targetId && <p>Cible : {log.targetId}</p>}
                            {log.details && <p className="break-words">Details : {log.details}</p>}
                        </CardContent>
                    </Card>
                ))}
                {logs.length === 0 && (
                    <Card>
                        <CardContent className="py-8 text-sm text-muted-foreground">
                            Aucun log systeme.
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
