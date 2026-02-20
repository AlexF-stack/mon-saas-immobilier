'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import type { NavItemSerializable } from '@/lib/dashboard-nav'

export interface AppLayoutProps {
  children: React.ReactNode
  navItems: NavItemSerializable[]
  role?: string
  userProfile?: { name: string | null; email: string }
}

export function AppLayout({ children, navItems, role, userProfile }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppSidebar
        navItems={navItems}
        role={role}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex min-h-screen min-w-0 flex-col">
        <AppHeader
          onMenuClick={() => setMobileMenuOpen((o) => !o)}
          userProfile={userProfile}
          role={role}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
