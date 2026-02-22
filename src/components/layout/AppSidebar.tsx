'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Building,
    CreditCard,
    FileText,
    Home,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    ScrollText,
    Settings,
    Store,
    Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItemSerializable } from '@/lib/dashboard-nav'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useLogout } from '@/hooks/use-logout'

const iconMap = {
  home: Home,
  chart: BarChart3,
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
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function AppSidebar({
  navItems,
  role,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { logout, loading: logoutLoading } = useLogout()
  const localeMatch = pathname.match(/^\/(en|fr)(?=\/|$)/)
  const localePrefix = localeMatch?.[0] ?? ''
  const homeHref = navItems.find((item) => item.iconKey === 'home')?.href ?? `${localePrefix}/dashboard`

  function renderNavContent(compact: boolean, allowScroll = false) {
    return (
      <nav
        className={cn(
          'min-h-0 flex flex-1 flex-col gap-1 py-4',
          allowScroll ? 'overflow-y-auto' : 'overflow-hidden',
          compact ? 'px-2' : 'px-3'
        )}
      >
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
                'hover:bg-surface hover:text-primary dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                compact && 'justify-center px-2',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-secondary dark:text-slate-300'
              )}
              title={compact ? item.name : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full transition-opacity',
                  isActive ? 'bg-blue-500 opacity-100' : 'opacity-0'
                )}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span
                className={cn(
                  'truncate transition-all duration-200',
                  compact && 'max-w-0 opacity-0'
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  function renderFooter(compact: boolean) {
    return (
      <div className="shrink-0 border-t border-border p-3 dark:border-slate-800">
        <div
          className={cn(
            'mb-2 px-3 text-xs text-secondary transition-all duration-200 dark:text-slate-400',
            compact && 'max-h-0 overflow-hidden p-0 opacity-0'
          )}
        >
          Connecte : {role}
        </div>
        <button
          type="button"
          onClick={() => {
            onMobileClose()
            void logout()
          }}
          disabled={logoutLoading}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
            compact && 'justify-center px-2',
            'text-secondary hover:bg-surface hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
            logoutLoading && 'cursor-not-allowed opacity-70'
          )}
          title={compact ? 'Deconnexion' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span
            className={cn(
              'truncate transition-all duration-200',
              compact && 'max-w-0 opacity-0'
            )}
          >
            {logoutLoading ? 'Deconnexion...' : 'Deconnexion'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 md:flex',
          collapsed ? 'w-20' : 'w-60'
        )}
      >
        <div className="flex h-16 items-center border-b border-border px-3 dark:border-slate-800">
          <Link
            href={homeHref}
            className={cn(
              'flex min-w-0 items-center gap-2 overflow-hidden font-semibold text-primary dark:text-slate-100',
              collapsed && 'gap-0'
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              I
            </span>
            <span
              className={cn(
                'truncate transition-all duration-200',
                collapsed && 'max-w-0 opacity-0'
              )}
            >
              ImmoSaaS
            </span>
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={collapsed ? 'Ouvrir la sidebar' : 'Replier la sidebar'}
            title={collapsed ? 'Ouvrir' : 'Replier'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {renderNavContent(collapsed, false)}
        {renderFooter(collapsed)}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
      <SheetContent
          side="left"
          className="data-[state=open]:duration-[var(--motion-modal)] data-[state=closed]:duration-[var(--motion-modal)] flex w-[85vw] max-w-xs flex-col border-border bg-card/95 p-0 text-primary backdrop-blur-md sm:max-w-sm dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <SheetHeader className="border-b border-border p-4 text-left dark:border-slate-800">
            <SheetTitle className="text-lg font-semibold text-primary dark:text-slate-100">
              ImmoSaaS
            </SheetTitle>
            {role && <span className="text-xs text-secondary dark:text-slate-400">Connecte : {role}</span>}
          </SheetHeader>
          {renderNavContent(false, true)}
          {renderFooter(false)}
        </SheetContent>
      </Sheet>
    </>
  )
}
