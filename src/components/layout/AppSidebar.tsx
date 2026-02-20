'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building,
    CreditCard,
    FileText,
    Home,
    LogOut,
    ScrollText,
    Settings,
    Store,
    Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItemSerializable } from '@/lib/dashboard-nav'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const iconMap = {
  home: Home,
  building: Building,
  users: Users,
  fileText: FileText,
  creditCard: CreditCard,
    settings: Settings,
    logs: ScrollText,
    store: Store,
} as const

interface AppSidebarProps {
  navItems: NavItemSerializable[]
  role?: string
  mobileOpen: boolean
  onMobileClose: () => void
}

export function AppSidebar({ navItems, role, mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname()
  const localeMatch = pathname.match(/^\/(en|fr)(?=\/|$)/)
  const localePrefix = localeMatch?.[0] ?? ''
  const homeHref = navItems.find((item) => item.iconKey === 'home')?.href ?? `${localePrefix}/dashboard`

  const navContent = (
    <nav className="min-h-0 flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const Icon = iconMap[item.iconKey as keyof typeof iconMap] ?? Home
        const isDashboardRootItem = /\/dashboard$/.test(item.href)
        const isActive = isDashboardRootItem
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onMobileClose}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150',
              'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
              isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full transition-opacity',
                isActive ? 'bg-blue-500 opacity-100' : 'opacity-0'
              )}
            />
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 px-3 text-xs text-slate-500 dark:text-slate-400">Connecte : {role}</div>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
            'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">Deconnexion</span>
        </button>
      </form>
    </div>
  )

  return (
    <>
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800">
          <Link
            href={homeHref}
            className="flex items-center gap-2 overflow-hidden font-semibold text-slate-900 dark:text-slate-100"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              I
            </span>
            <span className="truncate">ImmoSaaS</span>
          </Link>
        </div>
        {navContent}
        {footer}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent
          side="left"
          className="flex w-64 flex-col border-slate-200 bg-white/95 p-0 text-slate-900 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <SheetHeader className="border-b border-slate-200 p-4 text-left dark:border-slate-800">
            <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              ImmoSaaS
            </SheetTitle>
            {role && <span className="text-xs text-slate-500 dark:text-slate-400">Connecte : {role}</span>}
          </SheetHeader>
          {navContent}
          {footer}
        </SheetContent>
      </Sheet>
    </>
  )
}
