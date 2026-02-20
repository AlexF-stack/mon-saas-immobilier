'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Search, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const supportedLocales = new Set(['en', 'fr'])

interface AppHeaderProps {
  onMenuClick: () => void
  userProfile?: { name: string | null; email: string }
  role?: string
}

export function AppHeader({ onMenuClick, userProfile, role }: AppHeaderProps) {
  const pathname = usePathname()
  const firstSegment = pathname?.split('/')[1] ?? ''
  const localePrefix = supportedLocales.has(firstSegment) ? `/${firstSegment}` : ''
  const settingsHref = `${localePrefix}/dashboard/settings`
  const pathSegments = (pathname ?? '/')
    .split('/')
    .filter(Boolean)
    .filter((segment) => !supportedLocales.has(segment))
  const pageSegments = pathSegments.length > 0 ? pathSegments : ['dashboard']
  const pageLabels: Record<string, string> = {
    dashboard: 'Tableau de bord',
    properties: 'Biens',
    tenants: 'Locataires',
    contracts: 'Contrats',
    payments: 'Paiements',
    marketplace: 'Marketplace',
    settings: 'Parametres',
    users: 'Utilisateurs',
    logs: 'Logs',
    new: 'Nouveau',
  }
  const breadcrumb = pageSegments.map(
    (segment) => pageLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)
  )
  const pageTitle = breadcrumb[breadcrumb.length - 1] ?? 'Tableau de bord'
  const initials = userProfile?.name
    ? userProfile.name
        .trim()
        .split(/\s+/)
        .map((name) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : userProfile?.email?.slice(0, 2).toUpperCase() ?? 'U'

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/70',
        'dark:border-slate-800 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/70 md:px-8'
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {breadcrumb.join(' / ')}
        </p>
        <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</p>
      </div>

      <div className="hidden items-center gap-2 sm:flex md:w-64 lg:w-80">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher..."
            className="h-9 border-slate-200 bg-white/70 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            aria-label="Recherche"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-9 items-center gap-2 rounded-full pl-2 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800/70"
              aria-label="Profil"
            >
              <Avatar className="h-8 w-8 shrink-0 border border-slate-200 dark:border-slate-700">
                <AvatarFallback className="bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                {userProfile?.name || userProfile?.email || 'Compte'}
              </span>
              <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{userProfile?.name || 'Utilisateur'}</p>
                <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                {role && <p className="mt-1 text-xs text-muted-foreground">Role : {role}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={settingsHref} className="flex cursor-pointer items-center gap-2">
                <User className="h-4 w-4" />
                Parametres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/api/auth/logout" method="POST">
              <DropdownMenuItem asChild>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Deconnexion
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
