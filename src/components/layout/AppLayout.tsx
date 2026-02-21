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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="bg-grid noise-overlay flex min-h-screen overflow-x-clip bg-background text-primary">
      <AppSidebar
        navItems={navItems}
        role={role}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex min-h-screen min-w-0 flex-col">
        <AppHeader
          onMenuClick={() => setMobileMenuOpen((o) => !o)}
          userProfile={userProfile}
          role={role}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="animate-route-enter mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
