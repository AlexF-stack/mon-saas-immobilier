import { prisma } from '@/lib/prisma'
import { createAppNotification } from '@/lib/app-notifications'
import { notifyGuest, notifyUser } from '@/lib/notifications/dispatcher'

type InquiryContext = {
  id: string
  requesterUserId: string | null
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  property: { id: string; title: string; managerId: string | null }
}

export async function notifyInquiryVisitUpdate(
  inquiry: InquiryContext,
  options: {
    title: string
    message: string
    messagePreview: string
    guestAccessUrl?: string
  }
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${baseUrl}/dashboard/marketplace/inquiries?inquiryId=${inquiry.id}`

  if (inquiry.property.managerId) {
    await createAppNotification({
      userId: inquiry.property.managerId,
      type: 'MARKETPLACE_VISIT_UPDATE',
      title: options.title,
      message: options.message,
    })
  }

  if (inquiry.requesterUserId) {
    await createAppNotification({
      userId: inquiry.requesterUserId,
      type: 'MARKETPLACE_VISIT_UPDATE',
      title: options.title,
      message: options.message,
    })
    await notifyUser({
      userId: inquiry.requesterUserId,
      senderName: 'Plateforme',
      propertyTitle: inquiry.property.title,
      messagePreview: options.messagePreview,
      dashboardUrl,
    })
  } else if (options.guestAccessUrl) {
    await notifyGuest({
      email: inquiry.requesterEmail,
      phone: inquiry.requesterPhone,
      senderName: 'Plateforme',
      propertyTitle: inquiry.property.title,
      messagePreview: options.messagePreview,
      guestAccessUrl: options.guestAccessUrl,
    })
  }
}

export async function notifyInquiryLifecycleUpdate(
  inquiry: InquiryContext,
  stageLabel: string
) {
  const message = `Demande pour ${inquiry.property.title} : etape ${stageLabel}.`
  await notifyInquiryVisitUpdate(inquiry, {
    title: 'Mise a jour de la demande',
    message,
    messagePreview: message,
  })
}

export async function buildGuestAccessUrlForInquiry(inquiryId: string): Promise<string | undefined> {
  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { id: inquiryId },
    select: { guestAccessTokenHash: true, guestAccessTokenExpiresAt: true },
  })
  if (!inquiry?.guestAccessTokenHash) return undefined
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/marketplace/inquiries/${inquiryId}`
}
