export type NavItemSerializable = { name: string; href: string; iconKey: string }

export function getDashboardNav(role: string, locale?: string): NavItemSerializable[] {
    const prefix = locale ? `/${locale}` : ''

    const baseNavigation: NavItemSerializable[] = [
        { name: 'Accueil', href: `${prefix}/dashboard`, iconKey: 'home' },
        { name: 'Statistiques', href: `${prefix}/dashboard/statistics`, iconKey: 'chart' },
        { name: 'Biens', href: `${prefix}/dashboard/properties`, iconKey: 'building' },
        { name: 'Marketplace', href: `${prefix}/dashboard/marketplace`, iconKey: 'store' },
        { name: 'Locataires', href: `${prefix}/dashboard/tenants`, iconKey: 'users' },
        { name: 'Contrats', href: `${prefix}/dashboard/contracts`, iconKey: 'fileText' },
        { name: 'Paiements', href: `${prefix}/dashboard/payments`, iconKey: 'creditCard' },
        { name: 'Parametres', href: `${prefix}/dashboard/settings`, iconKey: 'settings' },
    ]

    if (role === 'ADMIN') {
        const nav = [...baseNavigation]
        nav.splice(1, 0, { name: 'Utilisateurs', href: `${prefix}/dashboard/users`, iconKey: 'users' })
        nav.splice(nav.length - 1, 0, { name: 'Logs', href: `${prefix}/dashboard/logs`, iconKey: 'logs' })
        return nav
    }

    if (role === 'MANAGER') {
        return baseNavigation
    }

    if (role === 'TENANT') {
        return [
            { name: 'Accueil', href: `${prefix}/dashboard`, iconKey: 'home' },
            { name: 'Contrats', href: `${prefix}/dashboard/contracts`, iconKey: 'fileText' },
            { name: 'Paiements', href: `${prefix}/dashboard/payments`, iconKey: 'creditCard' },
            { name: 'Parametres', href: `${prefix}/dashboard/settings`, iconKey: 'settings' },
        ]
    }

    return []
}
