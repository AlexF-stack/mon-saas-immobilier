import jwt, { type JwtPayload } from 'jsonwebtoken'

const DEV_FALLBACK_JWT_SECRET = 'supersecretkey'
const MIN_JWT_SECRET_LENGTH = 32
const USER_ROLES = ['ADMIN', 'MANAGER', 'TENANT'] as const
const USER_ROLE_ALIASES: Record<string, (typeof USER_ROLES)[number]> = {
    ADMIN: 'ADMIN',
    ADMINISTRATOR: 'ADMIN',
    SUPER_ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    OWNER: 'MANAGER',
    PROPRIETAIRE: 'MANAGER',
    TENANT: 'TENANT',
    LOCATAIRE: 'TENANT',
    RENTER: 'TENANT',
}

function getJwtSecret(): string {
    const configuredSecret = process.env.JWT_SECRET
    const secret = configuredSecret ?? DEV_FALLBACK_JWT_SECRET

    if (process.env.NODE_ENV === 'production') {
        if (!configuredSecret) {
            throw new Error('JWT_SECRET must be set in production')
        }

        if (configuredSecret.length < MIN_JWT_SECRET_LENGTH) {
            throw new Error(
                `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`
            )
        }
    }

    return secret
}

type EdgeAuthPayload = JwtPayload & {
    id: string
    email: string
    role: (typeof USER_ROLES)[number]
}

function isUserRole(value: string): value is (typeof USER_ROLES)[number] {
    return USER_ROLES.includes(value as (typeof USER_ROLES)[number])
}

function normalizeUserRole(value: string | null | undefined): (typeof USER_ROLES)[number] | null {
    if (!value) return null
    return USER_ROLE_ALIASES[value.trim().toUpperCase()] ?? null
}

function normalizeEdgeAuthPayload(payload: JwtPayload): EdgeAuthPayload | null {
    if (
        typeof payload.id !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.role !== 'string'
    ) {
        return null
    }

    const normalizedRole = normalizeUserRole(payload.role)
    if (!normalizedRole || !isUserRole(normalizedRole)) {
        return null
    }

    return {
        ...payload,
        id: payload.id,
        email: payload.email,
        role: normalizedRole,
    }
}

export async function verifyAuthEdge(token: string): Promise<EdgeAuthPayload | null> {
    try {
        const decoded = jwt.verify(token, getJwtSecret())
        if (typeof decoded === 'string') {
            return null
        }
        return normalizeEdgeAuthPayload(decoded)
    } catch {
        return null
    }
}
