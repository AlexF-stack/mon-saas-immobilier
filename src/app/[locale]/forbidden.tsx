'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
    const pathname = usePathname()
    const firstSegment = pathname?.split('/')[1] ?? 'en'
    const localePrefix = firstSegment === 'fr' || firstSegment === 'en' ? `/${firstSegment}` : '/en'

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldX className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-semibold">Accès refusé</h1>
                <p className="text-sm text-muted-foreground">
                    Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
                </p>
                <div className="flex justify-center gap-2">
                    <Link href={`${localePrefix}/dashboard`}>
                        <Button variant="outline">Retour au dashboard</Button>
                    </Link>
                    <Link href={`${localePrefix}/login`}>
                        <Button>Se connecter</Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
