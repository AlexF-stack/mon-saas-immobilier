import jwt, { type JwtPayload } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const DEV_FALLBACK_JWT_SECRET = 'supersecretkey'
const DEV_FALLBACK_PASSWORD_RESET_SECRET = 'supersecretkey-reset'
const MIN_JWT_SECRET_LENGTH = 32

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

function getPasswordResetSecret(): string {
    const configuredSecret = process.env.PASSWORD_RESET_JWT_SECRET
    const secret = configuredSecret ?? DEV_FALLBACK_PASSWORD_RESET_SECRET

    if (process.env.NODE_ENV === 'production') {
        if (!configuredSecret) {
            throw new Error('PASSWORD_RESET_JWT_SECRET must be set in production')
        }

        if (configuredSecret.length < MIN_JWT_SECRET_LENGTH) {
            throw new Error(
                `PASSWORD_RESET_JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`
            )
        }
    }

    return secret
}

export const USER_ROLES = ['ADMIN', 'MANAGER', 'TENANT'] as const
export type UserRole = (typeof USER_ROLES)[number]

const USER_ROLE_ALIASES: Record<string, UserRole> = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    OWNER: 'MANAGER',
    PROPRIETAIRE: 'MANAGER',
    TENANT: 'TENANT',
    LOCATAIRE: 'TENANT',
    RENTER: 'TENANT',
    ADMINISTRATOR: 'ADMIN',
    SUPER_ADMIN: 'ADMIN',
}

export function isUserRole(value: string): value is UserRole {
    return USER_ROLES.includes(value as UserRole)
}

export function normalizeUserRole(value: string | null | undefined): UserRole | null {
    if (!value) return null
    return USER_ROLE_ALIASES[value.trim().toUpperCase()] ?? null
}

export type AuthTokenPayload = JwtPayload & {
    id: string
    email: string
    role: UserRole
    name?: string | null
    isSuspended?: boolean
}

type PasswordResetTokenPayload = JwtPayload & {
    purpose: 'PASSWORD_RESET'
    id: string
    email: string
    jti: string
}

type AuthUserRecord = {
    id: string
    email: string
    role: string
    name: string | null
    isSuspended: boolean
}

function buildAuthPayload(user: AuthUserRecord): AuthTokenPayload | null {
    const normalizedRole = normalizeUserRole(user.role)
    if (!normalizedRole) {
        return null
    }

    return {
        id: user.id,
        email: user.email,
        role: normalizedRole,
        name: user.name,
        isSuspended: user.isSuspended,
    }
}

function normalizeTokenPayload(payload: JwtPayload): AuthTokenPayload | null {
    if (
        typeof payload.id !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.role !== 'string'
    ) {
        return null
    }

    const normalizedRole = normalizeUserRole(payload.role)
    if (!normalizedRole) {
        return null
    }

    return {
        ...payload,
        id: payload.id,
        email: payload.email,
        role: normalizedRole,
        name: typeof payload.name === 'string' || payload.name === null ? payload.name : null,
        isSuspended:
            typeof payload.isSuspended === 'boolean' ? payload.isSuspended : undefined,
    }
}

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10)
}

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash)
}

export const generateToken = (payload: AuthTokenPayload) => {
    const tokenPayload: AuthTokenPayload = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        name: payload.name ?? null,
    }

    return jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '1d' })
}

export const generatePasswordResetToken = (payload: {
    id: string
    email: string
    jti: string
}) => {
    const resetPayload: PasswordResetTokenPayload = {
        purpose: 'PASSWORD_RESET',
        id: payload.id,
        email: payload.email,
        jti: payload.jti,
    }

    return jwt.sign(resetPayload, getPasswordResetSecret(), {
        expiresIn: '15m',
    })
}

export const verifyPasswordResetToken = (
    token: string
): PasswordResetTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, getPasswordResetSecret())
        if (typeof decoded === 'string') {
            return null
        }

        if (
            decoded.purpose !== 'PASSWORD_RESET' ||
            typeof decoded.id !== 'string' ||
            typeof decoded.email !== 'string' ||
            typeof decoded.jti !== 'string'
        ) {
            return null
        }

        return {
            ...decoded,
            purpose: 'PASSWORD_RESET',
            id: decoded.id,
            email: decoded.email,
            jti: decoded.jti,
        }
    } catch {
        return null
    }
}

export const verifyToken = (token: string): AuthTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, getJwtSecret())
        if (typeof decoded === 'string') {
            return null
        }
        return normalizeTokenPayload(decoded)
    } catch {
        return null
    }
}

/** Recupere le JWT depuis la requete : cookie `token` ou en-tete Authorization Bearer. */
export function getTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers.get('Authorization')
    const bearer = authHeader?.match(/Bearer\s+(.+)/)?.[1]
    if (bearer) return bearer
    const cookieHeader = request.headers.get('Cookie')
    if (!cookieHeader) return null
    const match = cookieHeader.match(/token=([^;]+)/)
    return match ? match[1].trim() : null
}

export const verifyAuth = async (token: string): Promise<AuthTokenPayload | null> => {
    const decoded = verifyToken(token)
    if (!decoded) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
            id: true,
            email: true,
            role: true,
            name: true,
            isSuspended: true,
        },
    })

    if (!user || user.isSuspended) {
        return null
    }

    return buildAuthPayload(user)
}
