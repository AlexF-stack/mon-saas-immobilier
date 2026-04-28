/**
 * Email notifications via Resend
 * Required env vars: RESEND_API_KEY, EMAIL_FROM
 */
import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM ?? 'notifications@immo-saas.com'
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null

  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }

  return resendClient
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const resend = getResendClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping email notification')
    return
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  } catch (err) {
    console.error('[email] Failed to send email:', err)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function buildNewMessageEmailHtml(params: {
  recipientName: string
  senderName: string
  propertyTitle: string
  messagePreview: string
  dashboardUrl: string
}): string {
  return `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
    <h2 style="color: #1e3a8a; margin-bottom: 8px;">💬 Nouveau message</h2>
    <p style="color: #475569;">Bonjour <strong>${params.recipientName}</strong>,</p>
    <p style="color: #475569;">
      <strong>${params.senderName}</strong> vous a envoyé un message concernant le bien
      <strong>${params.propertyTitle}</strong> :
    </p>
    <div style="background: white; border-left: 4px solid #1e3a8a; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #1e293b;">
      <em>${params.messagePreview}</em>
    </div>
    <a href="${params.dashboardUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      Voir la conversation
    </a>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
      Vous recevez cet email car vous avez activé les notifications par email dans vos paramètres.
    </p>
  </div>`
}

export function buildNewInquiryEmailHtml(params: {
  ownerName: string
  requesterName: string
  propertyTitle: string
  message: string
  visitDate?: string
  dashboardUrl: string
}): string {
  return `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
    <h2 style="color: #1e3a8a;">🏠 Nouvelle demande de visite</h2>
    <p style="color: #475569;">Bonjour <strong>${params.ownerName}</strong>,</p>
    <p style="color: #475569;">
      <strong>${params.requesterName}</strong> est intéressé(e) par votre bien : <strong>${params.propertyTitle}</strong>
    </p>
    ${params.visitDate ? `<p style="color: #475569;">📅 Date souhaitée : <strong>${params.visitDate}</strong></p>` : ''}
    <div style="background: white; border-left: 4px solid #1e3a8a; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #1e293b;">
      <em>${params.message}</em>
    </div>
    <a href="${params.dashboardUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      Répondre maintenant
    </a>
  </div>`
}
