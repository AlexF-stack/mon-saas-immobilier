import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromHeaders } from '@/lib/request-metadata'
import type { AuthTokenPayload } from '@/lib/auth'

const RATE_LIMIT_TARGET_TYPE = 'RATE_LIMIT'

type RateLimitOptions = {
    request: Request
    bucket: string
    limit: number
    windowMs: number
    actor?: Pick<AuthTokenPayload, 'id' | 'email' | 'role'> | null
    extraKey?: string
    message?: string
}

function hashFingerprint(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex')
}

function buildFingerprint(
    request: Request,
    bucket: string,
    extraKey?: string
): string {
    const ip = getClientIpFromHeaders(request.headers) ?? 'unknown'
    const userAgent = request.headers.get('user-agent')?.slice(0, 128) ?? 'unknown'
    return hashFingerprint(`${bucket}|${ip}|${userAgent}|${extraKey ?? ''}`)
}

function bucketAction(bucket: string) {
    return `RATE_LIMIT_BUCKET_${bucket}`
}

function blockedAction(bucket: string) {
    return `RATE_LIMIT_BLOCKED_${bucket}`
}

export async function countRateLimitEvents(
    bucket: string,
    fingerprint: string,
    windowMs: number
) {
    const windowStart = new Date(Date.now() - windowMs)
    return prisma.systemLog.count({
        where: {
            action: bucketAction(bucket),
            targetType: RATE_LIMIT_TARGET_TYPE,
            targetId: fingerprint,
            createdAt: { gte: windowStart },
        },
    })
}

export async function recordRateLimitEvent(
    bucket: string,
    fingerprint: string,
    actor?: Pick<AuthTokenPayload, 'id' | 'email' | 'role'> | null
) {
    await prisma.systemLog.create({
        data: {
            actorId: actor?.id ?? null,
            actorEmail: actor?.email ?? null,
            actorRole: actor?.role ?? null,
            action: bucketAction(bucket),
            targetType: RATE_LIMIT_TARGET_TYPE,
            targetId: fingerprint,
        },
    })
}

export function buildRateLimitFingerprint(
    request: Request,
    bucket: string,
    extraKey?: string
) {
    return buildFingerprint(request, bucket, extraKey)
}

export async function enforceRateLimit(
    options: RateLimitOptions
): Promise<NextResponse | null> {
    const fingerprint = buildFingerprint(
        options.request,
        options.bucket,
        options.extraKey
    )

    const attemptCount = await countRateLimitEvents(
        options.bucket,
        fingerprint,
        options.windowMs
    )

    if (attemptCount >= options.limit) {
        await prisma.systemLog.create({
            data: {
                actorId: options.actor?.id ?? null,
                actorEmail: options.actor?.email ?? null,
                actorRole: options.actor?.role ?? null,
                action: blockedAction(options.bucket),
                targetType: RATE_LIMIT_TARGET_TYPE,
                targetId: fingerprint,
            },
        })
        const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000))
        return NextResponse.json(
            {
                error:
                    options.message ??
                    'Too many requests. Please retry later.',
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfterSeconds),
                    'X-RateLimit-Limit': String(options.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Window': String(options.windowMs),
                },
            }
        )
    }

    await recordRateLimitEvent(options.bucket, fingerprint, options.actor)
    return null
}
