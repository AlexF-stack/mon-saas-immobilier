import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import {
    buildGuestInquiryAccessExpiry,
    createGuestInquiryAccessToken,
    hashGuestInquiryAccessToken,
} from '@/lib/marketplace-inquiry-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_REQUESTS_ANON = Number.isFinite(Number(process.env.MARKETPLACE_INQUIRY_RATE_LIMIT_ANON))
    ? Math.max(1, Number(process.env.MARKETPLACE_INQUIRY_RATE_LIMIT_ANON))
    : 5
const RATE_LIMIT_MAX_REQUESTS_AUTH = Number.isFinite(Number(process.env.MARKETPLACE_INQUIRY_RATE_LIMIT_AUTH))
    ? Math.max(1, Number(process.env.MARKETPLACE_INQUIRY_RATE_LIMIT_AUTH))
    : 10

function isRateLimitDisabled(): boolean {
    return (
        process.env.DEMO_MODE === 'true' ||
        process.env.DISABLE_MARKETPLACE_INQUIRY_RATE_LIMIT === 'true'
    )
}

const createInquirySchema = z
    .object({
        propertyId: z.string().trim().cuid(),
        requesterName: z
            .string()
            .trim()
            .min(2)
            .max(120)
            .regex(/^[\p{L}\p{N}\s'.-]+$/u, 'Invalid name format')
            .optional(),
        requesterEmail: z.string().trim().email().max(254).optional(),
        requesterPhone: z
            .string()
            .trim()
            .regex(/^\+?[0-9\s().-]{8,25}$/, 'Invalid phone number')
            .optional(),
        message: z.string().trim().min(12).max(1500),
        preferredVisitDate: z.coerce.date().optional(),
        website: z.string().trim().max(0).optional(),
    })
    .strict()

function getClientIp(request: Request): string | null {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim()
        if (firstIp) return firstIp
    }

    const realIp = request.headers.get('x-real-ip')?.trim()
    if (realIp) return realIp

    return null
}

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const url = new URL(request.url)
        const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20

        const where =
            user.role === 'ADMIN'
                ? {}
                : user.role === 'MANAGER'
                    ? { property: { managerId: user.id } }
                    : { requesterUserId: user.id }

        const inquiries = await prisma.marketplaceInquiry.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                requesterName: true,
                requesterEmail: true,
                requesterPhone: true,
                message: true,
                preferredVisitDate: true,
                status: true,
                lifecycleStage: true,
                createdAt: true,
                requesterUserId: true,
                property: {
                    select: { id: true, title: true, managerId: true },
                },
            },
        })

        return NextResponse.json(inquiries)
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const rawBody = (await request.json()) as Record<string, unknown>
        const honeypot = typeof rawBody.website === 'string' ? rawBody.website.trim() : ''

        // Honeypot: answer success without persisting to reduce bot signal.
        if (honeypot.length > 0) {
            return NextResponse.json(
                { message: 'Demande envoyee. Le proprietaire vous contactera rapidement.' },
                { status: 201 }
            )
        }

        const parsed = createInquirySchema.parse(rawBody)
        const token = getTokenFromRequest(request)
        const user = token ? await verifyAuth(token) : null
        const requesterIp = getClientIp(request)

        if (parsed.preferredVisitDate && parsed.preferredVisitDate.getTime() < Date.now()) {
            return NextResponse.json(
                { error: 'preferredVisitDate must be in the future' },
                { status: 400 }
            )
        }

        const property = await prisma.property.findFirst({
            where: {
                id: parsed.propertyId,
                isPublished: true,
                status: 'AVAILABLE',
            },
            select: { id: true, title: true, managerId: true },
        })

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        const requesterName = parsed.requesterName ?? user?.name?.trim() ?? null
        const requesterEmail = parsed.requesterEmail?.toLowerCase() ?? user?.email?.toLowerCase() ?? null
        const requesterPhone = parsed.requesterPhone ?? user?.phone?.trim() ?? null

        if (!requesterName || !requesterEmail) {
            return NextResponse.json(
                { error: 'Requester name and email are required.' },
                { status: 400 }
            )
        }

        if (!isRateLimitDisabled()) {
            const rateLimitWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)
            const rateLimitIdentifiers: Array<Record<string, string>> = [{ requesterEmail }]
            if (user?.id) rateLimitIdentifiers.push({ requesterUserId: user.id })
            if (requesterIp) rateLimitIdentifiers.push({ requesterIp })

            const recentInquiries = await prisma.marketplaceInquiry.count({
                where: {
                    createdAt: { gte: rateLimitWindowStart },
                    OR: rateLimitIdentifiers,
                },
            })

            const maxRequests = user?.id ? RATE_LIMIT_MAX_REQUESTS_AUTH : RATE_LIMIT_MAX_REQUESTS_ANON
            if (recentInquiries >= maxRequests) {
                return NextResponse.json(
                    { error: 'Too many requests. Please try again later.' },
                    { status: 429 }
                )
            }
        }

        const guestAccessToken = !user ? createGuestInquiryAccessToken() : null
        const guestAccessTokenHash = guestAccessToken ? hashGuestInquiryAccessToken(guestAccessToken) : null
        const guestAccessTokenExpiresAt = guestAccessToken ? buildGuestInquiryAccessExpiry() : null

        const [inquiry] = await prisma.$transaction([
            prisma.marketplaceInquiry.create({
                data: {
                    propertyId: property.id,
                    requesterUserId: user?.id ?? null,
                    requesterIp,
                    requesterName,
                    requesterEmail,
                    requesterPhone,
                    message: parsed.message,
                    preferredVisitDate: parsed.preferredVisitDate,
                    lifecycleStage: 'LEAD',
                    guestAccessTokenHash,
                    guestAccessTokenExpiresAt,
                },
                select: {
                    id: true,
                    status: true,
                    lifecycleStage: true,
                    createdAt: true,
                },
            }),
            prisma.property.update({
                where: { id: property.id },
                data: { inquiriesCount: { increment: 1 } },
                select: { id: true },
            }),
        ])

        const recipientIds = new Set<string>()
        if (property.managerId) {
            recipientIds.add(property.managerId)
        } else {
            const admins = await prisma.user.findMany({
                where: { role: 'ADMIN', isSuspended: false },
                select: { id: true },
                take: 10,
            })
            for (const admin of admins) recipientIds.add(admin.id)
        }

        if (recipientIds.size > 0) {
            const preferredVisitSuffix = parsed.preferredVisitDate
                ? ` Visite souhaitee: ${parsed.preferredVisitDate.toISOString().slice(0, 10)}.`
                : ''

            await prisma.notification.createMany({
                data: [...recipientIds].map((recipientId) => ({
                    userId: recipientId,
                    type: 'MARKETPLACE_INQUIRY',
                    title: 'Nouvelle demande marketplace',
                    message: `${requesterName} a envoye une demande pour ${property.title}.${preferredVisitSuffix}`,
                })),
            })
        }

        await createSystemLog({
            actor: user,
            action: 'MARKETPLACE_INQUIRY_CREATED',
            targetType: 'MARKETPLACE_INQUIRY',
            targetId: inquiry.id,
            details: `propertyId=${property.id};requesterEmail=${requesterEmail};requesterIp=${requesterIp ?? 'none'}`,
        })

        return NextResponse.json(
            {
                inquiry,
                guestAccessToken,
                message: 'Demande envoyee. Le proprietaire vous contactera rapidement.',
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Create marketplace inquiry error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
