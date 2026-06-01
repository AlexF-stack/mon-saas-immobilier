import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'
import {
  buildGuestInquiryAccessExpiry,
  createGuestInquiryAccessToken,
  hashGuestInquiryAccessToken,
} from '@/lib/marketplace-inquiry-access'
import { notifyInquiryLifecycleUpdate, notifyInquiryVisitUpdate } from '@/lib/inquiry-notifications'
import { publishRealtime } from '@/lib/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIFECYCLE_STAGES = [
  'LEAD',
  'VISIT_SCHEDULED',
  'QUALIFIED',
  'APPROVED',
  'CONTRACT_DRAFT',
  'CONTRACT_SENT',
  'CLOSED',
] as const

const VISIT_STATUSES = ['REQUESTED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

const patchInquirySchema = z
  .object({
    lifecycleStage: z.enum(LIFECYCLE_STAGES).optional(),
    visitStatus: z.enum(VISIT_STATUSES).optional(),
    scheduledVisitAt: z.coerce.date().optional().nullable(),
    visitNotes: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()

const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Prospect',
  VISIT_SCHEDULED: 'Visite programmee',
  QUALIFIED: 'Qualifie',
  APPROVED: 'Approuve',
  CONTRACT_DRAFT: 'Brouillon contrat',
  CONTRACT_SENT: 'Contrat envoye',
  CLOSED: 'Cloture',
}

async function resolveInquiryAccess(inquiryId: string, userId: string, role: string) {
  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      requesterUserId: true,
      requesterName: true,
      requesterEmail: true,
      requesterPhone: true,
      lifecycleStage: true,
      visitStatus: true,
      scheduledVisitAt: true,
      visitNotes: true,
      preferredVisitDate: true,
      property: { select: { id: true, title: true, managerId: true } },
    },
  })
  if (!inquiry) return { inquiry: null, canManage: false }

  const canManage =
    role === 'ADMIN' || (role === 'MANAGER' && inquiry.property.managerId === userId)
  return { inquiry, canManage }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const access = await resolveInquiryAccess(id, user.id, user.role)
    if (!access.inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    }

    const isRequester = access.inquiry.requesterUserId === user.id
    if (!access.canManage && !isRequester && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(access.inquiry)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const access = await resolveInquiryAccess(id, user.id, user.role)
    if (!access.inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    }
    if (!access.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = patchInquirySchema.parse(await request.json())
    const data: {
      lifecycleStage?: string
      visitStatus?: string
      scheduledVisitAt?: Date | null
      visitNotes?: string | null
      visitReminderSentAt?: null
    } = {}

    if (payload.lifecycleStage) data.lifecycleStage = payload.lifecycleStage
    if (payload.visitStatus) data.visitStatus = payload.visitStatus
    if (typeof payload.visitNotes !== 'undefined') data.visitNotes = payload.visitNotes
    if (typeof payload.scheduledVisitAt !== 'undefined') {
      data.scheduledVisitAt = payload.scheduledVisitAt
      data.visitReminderSentAt = null
      if (payload.scheduledVisitAt) {
        data.lifecycleStage = data.lifecycleStage ?? 'VISIT_SCHEDULED'
        data.visitStatus = data.visitStatus ?? 'SCHEDULED'
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ a mettre a jour.' }, { status: 400 })
    }

    const updated = await prisma.marketplaceInquiry.update({
      where: { id },
      data,
      select: {
        id: true,
        lifecycleStage: true,
        visitStatus: true,
        scheduledVisitAt: true,
        visitNotes: true,
        preferredVisitDate: true,
        requesterUserId: true,
        requesterName: true,
        requesterEmail: true,
        requesterPhone: true,
        property: { select: { id: true, title: true, managerId: true } },
      },
    })

    let guestAccessUrl: string | undefined
    if (!updated.requesterUserId) {
      const guestToken = createGuestInquiryAccessToken()
      await prisma.marketplaceInquiry.update({
        where: { id },
        data: {
          guestAccessTokenHash: hashGuestInquiryAccessToken(guestToken),
          guestAccessTokenExpiresAt: buildGuestInquiryAccessExpiry(),
        },
      })
      guestAccessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/marketplace/inquiries/${id}?guestToken=${encodeURIComponent(guestToken)}`
    }

    if (payload.scheduledVisitAt) {
      const when = payload.scheduledVisitAt.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      })
      await notifyInquiryVisitUpdate(updated, {
        title: 'Visite programmee',
        message: `Visite confirmee pour ${updated.property.title} le ${when}.`,
        messagePreview: `Visite programmee le ${when}.`,
        guestAccessUrl,
      })
    } else if (payload.visitStatus === 'CONFIRMED' && updated.scheduledVisitAt) {
      const when = updated.scheduledVisitAt.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      })
      await notifyInquiryVisitUpdate(updated, {
        title: 'Visite confirmee',
        message: `Votre visite pour ${updated.property.title} est confirmee le ${when}.`,
        messagePreview: `Visite confirmee le ${when}.`,
        guestAccessUrl,
      })
    } else if (payload.lifecycleStage) {
      await notifyInquiryLifecycleUpdate(
        updated,
        STAGE_LABELS[payload.lifecycleStage] ?? payload.lifecycleStage
      )
    }

    publishRealtime(`inquiry:${id}:messages`, {
      inquiryId: id,
      type: 'INQUIRY_UPDATED',
      createdAt: new Date().toISOString(),
    })

    await createSystemLog({
      actor: user,
      action: 'MARKETPLACE_INQUIRY_UPDATED',
      targetType: 'MARKETPLACE_INQUIRY',
      targetId: id,
      details: `lifecycle=${updated.lifecycleStage};visitStatus=${updated.visitStatus};scheduled=${updated.scheduledVisitAt?.toISOString() ?? 'none'}`,
    })

    return NextResponse.json({ inquiry: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Inquiry update error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
