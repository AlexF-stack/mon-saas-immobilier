/**
 * SMS & WhatsApp notifications via Twilio
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_SMS_FROM        → e.g. +1234567890 (Twilio phone number)
 *   TWILIO_WHATSAPP_FROM   → e.g. whatsapp:+14155238886 (Twilio sandbox or approved number)
 */
import Twilio from 'twilio'

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return Twilio(sid, token)
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

export async function sendSms(params: {
  to: string
  body: string
}): Promise<void> {
  const client = getTwilioClient()
  const from = process.env.TWILIO_SMS_FROM

  if (!client || !from) {
    console.warn('[sms] Twilio not configured, skipping SMS notification')
    return
  }

  // Ensure the number has international format
  const to = params.to.startsWith('+') ? params.to : `+${params.to}`

  try {
    await client.messages.create({
      from,
      to,
      body: params.body,
    })
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err)
  }
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export async function sendWhatsApp(params: {
  to: string
  body: string
}): Promise<void> {
  const client = getTwilioClient()
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!client || !from) {
    console.warn('[whatsapp] Twilio not configured, skipping WhatsApp notification')
    return
  }

  // WhatsApp numbers must be prefixed with 'whatsapp:'
  const to = params.to.startsWith('whatsapp:')
    ? params.to
    : `whatsapp:${params.to.startsWith('+') ? params.to : `+${params.to}`}`

  try {
    await client.messages.create({
      from,
      to,
      body: params.body,
    })
  } catch (err) {
    console.error('[whatsapp] Failed to send WhatsApp message:', err)
  }
}

// ─── Message Templates ────────────────────────────────────────────────────────

export function buildNewMessageSmsText(params: {
  senderName: string
  propertyTitle: string
  messagePreview: string
  dashboardUrl: string
}): string {
  const preview = params.messagePreview.length > 80
    ? params.messagePreview.slice(0, 80) + '...'
    : params.messagePreview

  return `💬 Nouveau message de ${params.senderName} pour "${params.propertyTitle}" :\n"${preview}"\n\nRépondre : ${params.dashboardUrl}`
}

export function buildNewInquirySmsText(params: {
  requesterName: string
  propertyTitle: string
  visitDate?: string
  dashboardUrl: string
}): string {
  const visitLine = params.visitDate ? `\n📅 Visite souhaitée : ${params.visitDate}` : ''
  return `🏠 Nouvelle demande de visite de ${params.requesterName} pour "${params.propertyTitle}".${visitLine}\n\nVoir : ${params.dashboardUrl}`
}
