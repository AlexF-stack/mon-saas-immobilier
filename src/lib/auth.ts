import jwt, { type JwtPayload } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const SECRET_KEY = process.env.JWT_SECRET ?? 'supersecretkey'
const MIN_JWT_SECRET_LENGTH = 32

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production')
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET && process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`)
}

export const USER_ROLES = ['ADMIN', 'MANAGER', 'TENANT'] as const
export type UserRole = (typeof USER_ROLES)[number]

export function isUserRole(value: string): value is UserRole {
    return USER_ROLES.includes(value as UserRole)
}

export type AuthTokenPayload = JwtPayload & {
    id: string
    email: string
    role: UserRole
    name?: string | null
    isSuspended?: boolean
}

type AuthUserRecord = {
    id: string
    email: string
    role: string
    name: string | null
    isSuspended: boolean
}

function buildAuthPayload(user: AuthUserRecord): AuthTokenPayload | null {
    if (!isUserRole(user.role)) {
        return null
    }

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        isSuspended: user.isSuspended,
    }
}

function isAuthTokenPayload(payload: JwtPayload): payload is AuthTokenPayload {
    return (
        typeof payload.id === 'string' &&
        typeof payload.email === 'string' &&
        typeof payload.role === 'string' &&
        isUserRole(payload.role)
    )
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

    return jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '1d' })
}

export const verifyToken = (token: string): AuthTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, SECRET_KEY)
        if (typeof decoded === 'string' || !isAuthTokenPayload(decoded)) {
            return null
        }
        return decoded
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
