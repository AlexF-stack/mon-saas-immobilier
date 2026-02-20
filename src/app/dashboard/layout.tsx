import { AppLayout } from '@/components/layout/AppLayout'
import { getDashboardNav } from '@/lib/dashboard-nav'
import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await verifyAuth(token) : null
    if (!user) {
        redirect('/login')
    }
    const role = user.role
    const navItems = getDashboardNav(role)
    const userProfile = user
        ? { name: user.name ?? null, email: user.email ?? '' }
        : undefined

    return (
        <AppLayout navItems={navItems} role={role} userProfile={userProfile}>
            {children}
        </AppLayout>
    )
}

