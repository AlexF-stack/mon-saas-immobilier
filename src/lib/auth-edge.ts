import jwt, { type JwtPayload } from 'jsonwebtoken'

const SECRET_KEY = process.env.JWT_SECRET ?? 'supersecretkey'
const MIN_JWT_SECRET_LENGTH = 32
const USER_ROLES = ['ADMIN', 'MANAGER', 'TENANT'] as const

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production')
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET && process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`)
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
        const decoded = jwt.verify(token, SECRET_KEY)
        if (typeof decoded === 'string' || !isEdgeAuthPayload(decoded)) {
            return null
        }
        return decoded
    } catch {
        return null
    }
}
