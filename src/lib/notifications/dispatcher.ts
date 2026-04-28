import { prisma } from '@/lib/prisma'
import { sendEmail, buildNewMessageEmailHtml } from './email'
import { sendSms, sendWhatsApp, buildNewMessageSmsText } from './twilio'

interface NotifyUserParams {
  userId: string
  senderName: string
  propertyTitle: string
  messagePreview: string
  dashboardUrl: string
}

export async function notifyUser(params: NotifyUserParams) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      email: true,
      phone: true,
      notifyEmail: true,
      notifySms: true,
      notifyWhatsapp: true,
      name: true,
    },
  })

  if (!user) return

  const emailHtml = buildNewMessageEmailHtml({
    recipientName: user.name || 'Utilisateur',
    senderName: params.senderName,
    propertyTitle: params.propertyTitle,
    messagePreview: params.messagePreview,
    dashboardUrl: params.dashboardUrl,
  })

  const smsText = buildNewMessageSmsText({
    senderName: params.senderName,
    propertyTitle: params.propertyTitle,
    messagePreview: params.messagePreview,
    dashboardUrl: params.dashboardUrl,
  })

  // Send Email
  if (user.notifyEmail && user.email) {
    await sendEmail({
      to: user.email,
      subject: `Nouveau message: ${params.propertyTitle}`,
      html: emailHtml,
    })
  }

  // Send SMS
  if (user.notifySms && user.phone) {
    await sendSms({
      to: user.phone,
      body: smsText,
    })
  }

  // Send WhatsApp
  if (user.notifyWhatsapp && user.phone) {
    await sendWhatsApp({
      to: user.phone,
      body: smsText,
    })
  }
}

export async function notifyGuest(params: {
  email: string
  phone?: string | null
  senderName: string
  propertyTitle: string
  messagePreview: string
  guestAccessUrl: string
}) {
  // Guests always get emails if they provided one
  const emailHtml = buildNewMessageEmailHtml({
    recipientName: 'Invité',
    senderName: params.senderName,
    propertyTitle: params.propertyTitle,
    messagePreview: params.messagePreview,
    dashboardUrl: params.guestAccessUrl,
  })

  await sendEmail({
    to: params.email,
    subject: `Nouveau message: ${params.propertyTitle}`,
    html: emailHtml,
  })

  // Optional SMS if phone is provided
  if (params.phone) {
    const smsText = buildNewMessageSmsText({
      senderName: params.senderName,
      propertyTitle: params.propertyTitle,
      messagePreview: params.messagePreview,
      dashboardUrl: params.guestAccessUrl,
    })
    await sendSms({ to: params.phone, body: smsText })
    await sendWhatsApp({ to: params.phone, body: smsText })
  }
}
