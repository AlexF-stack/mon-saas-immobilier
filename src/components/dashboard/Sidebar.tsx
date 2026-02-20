import { LogOut } from 'lucide-react'
import { getDashboardNav } from '@/lib/dashboard-nav'
import { SidebarNavLink } from './SidebarNavLink'

interface SidebarProps {
    role?: string
}

export function Sidebar({ role }: SidebarProps) {
    const navItems = getDashboardNav(role ?? '')

    return (
        <aside className="hidden md:flex h-full flex-col bg-card text-primary w-64 shrink-0">
            <div className="flex h-16 items-center justify-center border-b border-border shrink-0">
                <h1 className="text-xl font-bold truncate px-2">ImmoSaaS</h1>
                {role && (
                    <span className="ml-2 text-xs bg-surface text-secondary px-2 py-1 rounded shrink-0">{role}</span>
                )}
            </div>
            <nav className="flex-1 overflow-y-auto space-y-1 px-2 py-4 min-h-0">
                {navItems.map((item) => (
                    <SidebarNavLink key={item.name} item={item} />
                ))}
            </nav>
            <div className="border-t border-border p-4 shrink-0">
                <div className="mb-4 px-2 text-xs text-secondary">Connecté : {role}</div>
                <form action="/api/auth/logout" method="POST">
                    <button
                        type="submit"
                        className="flex w-full items-center text-sm font-medium text-secondary hover:text-primary rounded-md px-2 py-2 hover:bg-card transition-colors"
                    >
                        <LogOut className="mr-3 h-6 w-6 flex-shrink-0" />
                        Déconnexion
                    </button>
                </form>
            </div>
        </aside>
    )
}
