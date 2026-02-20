'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, LogOut, Home, Building, Users, FileText, CreditCard, Settings } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { NavItemSerializable } from '@/lib/dashboard-nav'

const iconMap = {
    home: Home,
    building: Building,
    users: Users,
    fileText: FileText,
    creditCard: CreditCard,
    settings: Settings,
} as const

interface MobileNavProps {
    navItems: NavItemSerializable[]
    role?: string
}

export function MobileNav({ navItems, role }: MobileNavProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    return (
        <div className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Menu">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b text-left">
                        <SheetTitle className="text-lg font-bold">ImmoSaaS</SheetTitle>
                        {role && (
                            <span className="text-xs text-muted-foreground">Connecté : {role}</span>
                        )}
                    </SheetHeader>
                    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                        {navItems.map((item) => {
                            const Icon = iconMap[item.iconKey as keyof typeof iconMap] ?? Home
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        pathname === item.href
                                            ? 'bg-muted text-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    <Icon className="h-5 w-5 shrink-0" />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="border-t p-4">
                        <form action="/api/auth/logout" method="POST">
                            <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
                                <LogOut className="h-5 w-5" />
                                Déconnexion
                            </Button>
                        </form>
                    </div>
                </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold truncate">ImmoSaaS</span>
            <div className="w-10" />
        </div>
    )
}
