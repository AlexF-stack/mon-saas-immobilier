'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Search, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/theme-toggle'
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
import { useLogout } from '@/hooks/use-logout'

const supportedLocales = new Set(['en', 'fr'])

interface AppHeaderProps {
  onMenuClick: () => void
  userProfile?: { name: string | null; email: string }
  role?: string
}

export function AppHeader({ onMenuClick, userProfile, role }: AppHeaderProps) {
  const pathname = usePathname()
  const { logout, loading: logoutLoading } = useLogout()
  const firstSegment = pathname?.split('/')[1] ?? ''
  const localePrefix = supportedLocales.has(firstSegment) ? `/${firstSegment}` : ''
  const settingsHref = `${localePrefix}/dashboard/settings`
  const pathSegments = (pathname ?? '/')
    .split('/')
    .filter(Boolean)
    .filter((segment) => !supportedLocales.has(segment))
  const pageSegments = pathSegments.length > 0 ? pathSegments : ['dashboard']
  const pageLabels: Record<string, string> = {
    dashboard: 'Accueil',
    statistics: 'Statistiques',
    analytics: 'Analytics',
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
  const roleLabelMap: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    TENANT: 'Locataire',
  }
  const roleLabel = role ? roleLabelMap[role] ?? role : null
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
        'animate-fade-in relative sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-sky-200/75 bg-gradient-to-r from-sky-100/92 via-blue-50/88 to-cyan-100/92 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-sky-100/82 supports-[backdrop-filter]:via-blue-50/78 supports-[backdrop-filter]:to-cyan-100/82 dark:border-sky-900/45 dark:bg-gradient-to-r dark:from-slate-950/78 dark:via-sky-950/50 dark:to-blue-950/68 sm:px-6 lg:px-8'
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
      />

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
        <p className="hidden text-xs uppercase tracking-wide text-secondary sm:block">
          {breadcrumb.join(' / ')}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-lg font-semibold text-primary">{pageTitle}</p>
          {roleLabel ? (
            <span className="hidden rounded-full border border-sky-300/70 bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-800/60 dark:bg-sky-500/15 dark:text-sky-100 sm:inline-flex">
              {roleLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex md:w-64 lg:w-80">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <Input
            type="search"
            placeholder="Rechercher..."
            className="h-9 rounded-full border-sky-300/75 bg-white/75 pl-9 text-primary placeholder:text-secondary/80 backdrop-blur-sm dark:border-sky-900/55 dark:bg-sky-950/25"
            aria-label="Recherche"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-md border border-sky-300/75 bg-white/75 text-secondary backdrop-blur-sm hover:bg-sky-100/80 hover:text-sky-900 dark:border-sky-900/55 dark:bg-sky-950/25 dark:hover:bg-sky-500/15 dark:hover:text-sky-100"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-9 items-center gap-2 rounded-md border border-sky-300/75 bg-white/75 pl-2 pr-2 backdrop-blur-sm hover:border-sky-400/80 hover:bg-sky-100/80 dark:border-sky-900/55 dark:bg-sky-950/25 dark:hover:border-sky-700/70 dark:hover:bg-sky-500/15"
              aria-label="Profil"
            >
              <Avatar className="h-8 w-8 shrink-0 border border-slate-200 dark:border-slate-700">
                <AvatarFallback className="bg-sky-100 text-xs font-medium text-sky-700 dark:bg-sky-900/35 dark:text-sky-200">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">
                {userProfile?.name || userProfile?.email || 'Compte'}
              </span>
              <ChevronDown className="hidden h-4 w-4 shrink-0 text-secondary md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-border bg-card backdrop-blur-md"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{userProfile?.name || 'Utilisateur'}</p>
                <p className="text-xs text-secondary">{userProfile?.email}</p>
                {role && <p className="mt-1 text-xs text-secondary">Role : {role}</p>}
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
            <DropdownMenuItem
              disabled={logoutLoading}
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault()
                void logout()
              }}
            >
              <LogOut className="h-4 w-4" />
              {logoutLoading ? 'Deconnexion...' : 'Deconnexion'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
