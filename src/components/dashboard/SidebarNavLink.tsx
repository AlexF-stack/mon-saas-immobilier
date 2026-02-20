'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Building, Users, FileText, CreditCard, Settings } from 'lucide-react'
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

export function SidebarNavLink({ item }: { item: NavItemSerializable }) {
    const pathname = usePathname()
    const isActive = pathname === item.href
    const Icon = iconMap[item.iconKey as keyof typeof iconMap] ?? Home
    return (
        <Link
            href={item.href}
            className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                isActive ? 'bg-card text-primary' : 'text-secondary hover:bg-card hover:text-primary'
            )}
        >
            <Icon className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{item.name}</span>
        </Link>
    )
}
