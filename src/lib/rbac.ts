import type { AuthTokenPayload, UserRole } from '@/lib/auth'

export function hasAnyRole(user: AuthTokenPayload | null, roles: UserRole[]): user is AuthTokenPayload {
    if (!user) return false
    return roles.includes(user.role)
}

export function canManageProperty(user: AuthTokenPayload, managerId: string | null) {
    return user.role === 'ADMIN' || (user.role === 'MANAGER' && managerId === user.id)
}

export function canAccessContractScope(user: AuthTokenPayload, contract: {
    tenantId: string
    property: { managerId: string | null }
}) {
    if (user.role === 'ADMIN') return true
    if (user.role === 'MANAGER') return contract.property.managerId === user.id
    return contract.tenantId === user.id
}
