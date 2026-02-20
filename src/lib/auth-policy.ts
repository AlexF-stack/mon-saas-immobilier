import type { UserRole } from '@/lib/auth'

export type PublicRegistrationRole = 'PROPRIETAIRE' | 'LOCATAIRE'

type NormalizeRoleResult =
    | { ok: true; publicRole: PublicRegistrationRole; internalRole: UserRole }
    | { ok: false; error: string }

const ROLE_ALIASES: Record<string, PublicRegistrationRole | 'ADMIN'> = {
    PROPRIETAIRE: 'PROPRIETAIRE',
    MANAGER: 'PROPRIETAIRE',
    OWNER: 'PROPRIETAIRE',
    LOCATAIRE: 'LOCATAIRE',
    TENANT: 'LOCATAIRE',
    ADMIN: 'ADMIN',
}

// At least 8 chars with upper/lower case, digit and special char.
const PASSWORD_COMPLEXITY_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[^\s]{8,}$/

export function validatePasswordComplexity(password: string): boolean {
    return PASSWORD_COMPLEXITY_REGEX.test(password)
}

export function normalizeRequestedRole(value: unknown): NormalizeRoleResult {
    if (typeof value !== 'string' || !value.trim()) {
        return {
            ok: true,
            publicRole: 'LOCATAIRE',
            internalRole: 'TENANT',
        }
    }

    const normalized = value.trim().toUpperCase()
    const alias = ROLE_ALIASES[normalized]

    if (!alias) {
        return { ok: false, error: 'Invalid role requested' }
    }

    if (alias === 'ADMIN') {
        return {
            ok: false,
            error: 'Admin role cannot be created via public registration',
        }
    }

    return {
        ok: true,
        publicRole: alias,
        internalRole: alias === 'PROPRIETAIRE' ? 'MANAGER' : 'TENANT',
    }
}

export function getDashboardPathForRole(role: UserRole): string {
    if (role === 'MANAGER') return '/dashboard/properties'
    if (role === 'TENANT') return '/dashboard/contracts'
    return '/dashboard/users'
}
