import { prisma } from '@/lib/prisma'
import { createAppNotification } from '@/lib/app-notifications'
import { notifyGuest, notifyUser } from '@/lib/notifications/dispatcher'

export async function sendUpcomingVisitReminders() {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const windowEnd = new Date(in24h.getTime() + 60 * 60 * 1000)

  const inquiries = await prisma.marketplaceInquiry.findMany({
    where: {
      visitStatus: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledVisitAt: { gte: in24h, lt: windowEnd },
      visitReminderSentAt: null,
    },
    select: {
      id: true,
      requesterUserId: true,
      requesterName: true,
      requesterEmail: true,
      requesterPhone: true,
      scheduledVisitAt: true,
      property: { select: { title: true, managerId: true } },
    },
    take: 100,
  })

  let sent = 0
  for (const inquiry of inquiries) {
    if (!inquiry.scheduledVisitAt) continue
    const when = inquiry.scheduledVisitAt.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const message = `Rappel : visite prevue demain pour ${inquiry.property.title} (${when}).`
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (inquiry.property.managerId) {
      await createAppNotification({
        userId: inquiry.property.managerId,
        type: 'MARKETPLACE_VISIT_REMINDER',
        title: 'Rappel visite',
        message,
      })
    }

    if (inquiry.requesterUserId) {
      await createAppNotification({
        userId: inquiry.requesterUserId,
        type: 'MARKETPLACE_VISIT_REMINDER',
        title: 'Rappel visite',
        message,
      })
      await notifyUser({
        userId: inquiry.requesterUserId,
        senderName: 'Plateforme',
        propertyTitle: inquiry.property.title,
        messagePreview: message,
        dashboardUrl: `${baseUrl}/dashboard/marketplace/inquiries?inquiryId=${inquiry.id}`,
      })
    } else {
      await notifyGuest({
        email: inquiry.requesterEmail,
        phone: inquiry.requesterPhone,
        senderName: 'Plateforme',
        propertyTitle: inquiry.property.title,
        messagePreview: message,
        guestAccessUrl: `${baseUrl}/marketplace/inquiries/${inquiry.id}`,
      })
    }

    await prisma.marketplaceInquiry.update({
      where: { id: inquiry.id },
      data: { visitReminderSentAt: new Date() },
    })
    sent += 1
  }

  return { scanned: inquiries.length, sent }
}
