import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_REQUESTS = 5

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

        if (!requesterName || !requesterEmail) {
            return NextResponse.json(
                { error: 'Requester name and email are required.' },
                { status: 400 }
            )
        }

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

        if (recentInquiries >= RATE_LIMIT_MAX_REQUESTS) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            )
        }

        const [inquiry] = await prisma.$transaction([
            prisma.marketplaceInquiry.create({
                data: {
                    propertyId: property.id,
                    requesterUserId: user?.id ?? null,
                    requesterIp,
                    requesterName,
                    requesterEmail,
                    requesterPhone: parsed.requesterPhone,
                    message: parsed.message,
                    preferredVisitDate: parsed.preferredVisitDate,
                },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                },
            }),
            prisma.property.update({
                where: { id: property.id },
                data: { inquiriesCount: { increment: 1 } },
                select: { id: true },
            }),
        ])

        if (property.managerId) {
            await prisma.notification.create({
                data: {
                    userId: property.managerId,
                    type: 'MARKETPLACE_INQUIRY',
                    title: 'Nouvelle demande marketplace',
                    message: `${requesterName} a envoye une demande pour ${property.title}.`,
                },
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
