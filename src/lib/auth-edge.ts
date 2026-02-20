import jwt, { type JwtPayload } from 'jsonwebtoken'

const DEV_FALLBACK_JWT_SECRET = 'supersecretkey'
const MIN_JWT_SECRET_LENGTH = 32
const USER_ROLES = ['ADMIN', 'MANAGER', 'TENANT'] as const

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

function isEdgeAuthPayload(payload: JwtPayload): payload is EdgeAuthPayload {
    return (
        typeof payload.id === 'string' &&
        typeof payload.email === 'string' &&
        typeof payload.role === 'string' &&
        isUserRole(payload.role)
    )
}

export async function verifyAuthEdge(token: string): Promise<EdgeAuthPayload | null> {
    try {
        const decoded = jwt.verify(token, getJwtSecret())
        if (typeof decoded === 'string' || !isEdgeAuthPayload(decoded)) {
            return null
        }
        return decoded
    } catch {
        return null
    }
}
