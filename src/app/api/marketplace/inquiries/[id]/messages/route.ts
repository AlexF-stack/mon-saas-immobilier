import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import { notifyUser, notifyGuest } from '@/lib/notifications/dispatcher'
import {
  buildGuestInquiryAccessExpiry,
  createGuestInquiryAccessToken,
  hashGuestInquiryAccessToken,
  isGuestInquiryAccessExpired,
} from '@/lib/marketplace-inquiry-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
})

async function resolveInquiryForUser(inquiryId: string, userId: string, role: string) {
  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      requesterUserId: true,
      requesterName: true,
      requesterEmail: true,
      requesterPhone: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      property: {
        select: {
          id: true,
          title: true,
          managerId: true,
          manager: {
            select: { id: true, name: true, email: true, phone: true, preferredLanguage: true },
          },
        },
      },
    },
  })

  if (!inquiry) return { inquiry: null, canAccess: false }

  const canAccess =
    role === 'ADMIN' ||
    (role === 'MANAGER' && inquiry.property.managerId === userId) ||
    inquiry.requesterUserId === userId

  return { inquiry, canAccess }
}

async function resolveInquiryForGuest(inquiryId: string, guestToken: string) {
  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      requesterUserId: true,
      requesterName: true,
      requesterEmail: true,
      requesterPhone: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      property: {
        select: {
          id: true,
          title: true,
          managerId: true,
          manager: {
            select: { id: true, name: true, email: true, phone: true, preferredLanguage: true },
          },
        },
      },
    },
  })

  if (!inquiry) return { inquiry: null, canAccess: false }
  if (!inquiry.guestAccessTokenHash || !guestToken) return { inquiry, canAccess: false }
  if (isGuestInquiryAccessExpired(inquiry.guestAccessTokenExpiresAt)) {
    return { inquiry, canAccess: false }
  }

  const providedHash = hashGuestInquiryAccessToken(guestToken)
  return { inquiry, canAccess: providedHash === inquiry.guestAccessTokenHash }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const guestToken = url.searchParams.get('guestToken')?.trim() ?? ''
    const token = getTokenFromRequest(request)
    const user = token ? await verifyAuth(token) : null
    const access = user
      ? await resolveInquiryForUser(id, user.id, user.role)
      : guestToken
        ? await resolveInquiryForGuest(id, guestToken)
        : { inquiry: null, canAccess: false }
    const { inquiry, canAccess } = access
    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    if (!canAccess) {
      return NextResponse.json({ error: user ? 'Forbidden' : 'Unauthorized' }, { status: user ? 403 : 401 })
    }

    const messages = await prisma.marketplaceInquiryMessage.findMany({
      where: { inquiryId: inquiry.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        message: true,
        createdAt: true,
        senderUserId: true,
        senderGuestName: true,
        senderGuestEmail: true,
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    if (!user && guestToken) {
      await prisma.marketplaceInquiry.update({
        where: { id: inquiry.id },
        data: { guestLastSeenAt: new Date() },
        select: { id: true },
      })
    }

    return NextResponse.json({
      inquiry: {
        id: inquiry.id,
        propertyId: inquiry.property.id,
        propertyTitle: inquiry.property.title,
        requesterName: inquiry.requesterName,
        requesterEmail: inquiry.requesterEmail,
      },
      guestAccess: !user,
      messages,
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const { id } = await params
    const token = getTokenFromRequest(request)
    const user = token ? await verifyAuth(token) : null
    const rawPayload = await request.json()
    const payload = createMessageSchema.parse(rawPayload)
    const guestToken =
      typeof (rawPayload as { guestToken?: unknown }).guestToken === 'string'
        ? (rawPayload as { guestToken: string }).guestToken.trim()
        : ''
    const access = user
      ? await resolveInquiryForUser(id, user.id, user.role)
      : guestToken
        ? await resolveInquiryForGuest(id, guestToken)
        : { inquiry: null, canAccess: false }
    const { inquiry, canAccess } = access
    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    if (!canAccess) {
      return NextResponse.json({ error: user ? 'Forbidden' : 'Unauthorized' }, { status: user ? 403 : 401 })
    }

    const message = await prisma.marketplaceInquiryMessage.create({
      data: {
        inquiryId: inquiry.id,
        senderUserId: user?.id ?? null,
        senderGuestName: user ? null : inquiry.requesterName,
        senderGuestEmail: user ? null : inquiry.requesterEmail,
        message: payload.message,
      },
      select: {
        id: true,
        message: true,
        createdAt: true,
        senderUserId: true,
        senderGuestName: true,
        senderGuestEmail: true,
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    // Create internal notifications for Dashboard users
    const recipientIds = new Set<string>()
    if (inquiry.requesterUserId && inquiry.requesterUserId !== user?.id) recipientIds.add(inquiry.requesterUserId)
    if (inquiry.property.managerId && inquiry.property.managerId !== user?.id) {
      recipientIds.add(inquiry.property.managerId)
    }

    if (recipientIds.size > 0) {
      await prisma.notification.createMany({
        data: [...recipientIds].map((recipientId) => ({
          userId: recipientId,
          type: 'MARKETPLACE_INQUIRY_MESSAGE',
          title: 'Nouveau message visite',
          message: `Nouveau message sur la demande pour ${inquiry.property.title}.`,
        })),
      })
    }

    // External Notifications (Email/WhatsApp)
    try {
      const isManager = user?.id === inquiry.property.managerId
      const senderName = user?.name || inquiry.requesterName || 'Un visiteur'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const dashboardUrl = `${baseUrl}/dashboard/marketplace/inquiries?inquiryId=${inquiry.id}`

      if (isManager) {
        // Notify the visitor (Guest or Tenant)
        if (inquiry.requesterUserId) {
          // Internal user recipient
          await notifyUser({
            userId: inquiry.requesterUserId,
            senderName,
            propertyTitle: inquiry.property.title,
            messagePreview: payload.message,
            dashboardUrl,
          })
        } else {
          // Guest recipient
          const guestAccessToken = createGuestInquiryAccessToken()
          const guestAccessTokenHash = hashGuestInquiryAccessToken(guestAccessToken)
          const guestAccessTokenExpiresAt = buildGuestInquiryAccessExpiry()

          await prisma.marketplaceInquiry.update({
            where: { id: inquiry.id },
            data: {
              guestAccessTokenHash,
              guestAccessTokenExpiresAt,
            },
            select: { id: true },
          })

          await notifyGuest({
            email: inquiry.requesterEmail,
            phone: inquiry.requesterPhone,
            senderName,
            propertyTitle: inquiry.property.title,
            messagePreview: payload.message,
            guestAccessUrl: `${baseUrl}/marketplace/inquiries/${inquiry.id}?guestToken=${encodeURIComponent(guestAccessToken)}`,
          })
        }
      } else {
        // Notify the Manager
        if (inquiry.property.managerId) {
          await notifyUser({
            userId: inquiry.property.managerId,
            senderName,
            propertyTitle: inquiry.property.title,
            messagePreview: payload.message,
            dashboardUrl,
          })
        }
      }
    } catch (err) {
      console.error('External notification error:', err)
    }

    await createSystemLog({
      actor: user ?? null,
      action: 'MARKETPLACE_INQUIRY_MESSAGE_CREATED',
      targetType: 'MARKETPLACE_INQUIRY',
      targetId: inquiry.id,
    })

    if (!user) {
      await prisma.marketplaceInquiry.update({
        where: { id: inquiry.id },
        data: { guestLastSeenAt: new Date() },
        select: { id: true },
      })
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Inquiry message error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
