import { prisma } from '@/lib/prisma'
import { createSystemLog } from '@/lib/audit'

export const REMINDER_DAY_OFFSETS = [7, 5, 3, 1] as const
const REMINDER_WEBHOOK_TIMEOUT_MS = 6000

export type ReminderDayOffset = (typeof REMINDER_DAY_OFFSETS)[number]
export type ReminderDeliveryChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'

type Recipient = {
  id: string
  name: string | null
  email: string
  phone: string | null
  preferredLanguage: string
  notifyEmail: boolean
  notifySms: boolean
}

type ReminderCopy = {
  title: string
  inAppMessage: string
  emailSubject: string
  emailBody: string
  smsBody: string
  whatsappBody: string
}

type ReminderCandidate = {
  contractId: string
  rentAmount: number
  propertyTitle: string
  dueDate: Date
  previousDueDate: Date
  daysBefore: ReminderDayOffset
  tenant: Recipient
  manager: Recipient | null
}

type ReminderChannelMetrics = {
  emailSent: number
  emailSkipped: number
  smsSent: number
  smsSkipped: number
  whatsappSent: number
  whatsappSkipped: number
  failures: number
}

export type PaymentReminderRunSummary = {
  runDate: string
  scannedContracts: number
  dueCandidates: number
  remindersSent: number
  duplicateSkipped: number
  paidSkipped: number
  inAppNotifications: number
  emailSent: number
  emailSkipped: number
  smsSent: number
  smsSkipped: number
  whatsappSent: number
  whatsappSkipped: number
  failures: number
}

export type ManualPaymentReminderResult = {
  reminderKey: string
  dueDate: string
  daysBefore: ReminderDayOffset
  inAppNotificationSent: boolean
  emailSent: number
  emailSkipped: number
  smsSent: number
  smsSkipped: number
  whatsappSent: number
  whatsappSkipped: number
  failures: number
}

function toUtcDayStart(value: Date): Date {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcDays(value: Date, days: number): Date {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

function addUtcMonths(value: Date, months: number): Date {
  const date = new Date(value)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date
}

function isSameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  )
}

function getDaysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function resolveDueDateForMonth(anchorStartDate: Date, targetMonthDate: Date): Date {
  const year = targetMonthDate.getUTCFullYear()
  const monthIndex = targetMonthDate.getUTCMonth()
  const anchorDay = anchorStartDate.getUTCDate()
  const monthLastDay = getDaysInUtcMonth(year, monthIndex)
  const day = Math.min(anchorDay, monthLastDay)
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function resolveNextDueDate(anchorStartDate: Date, fromDate: Date): Date {
  const currentMonthDue = resolveDueDateForMonth(anchorStartDate, fromDate)
  const fromDay = toUtcDayStart(fromDate)
  if (currentMonthDue >= fromDay) {
    return currentMonthDue
  }
  return resolveDueDateForMonth(anchorStartDate, addUtcMonths(fromDate, 1))
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeLocale(preferredLanguage: string | null | undefined): 'fr' | 'en' {
  if (preferredLanguage?.toLowerCase().startsWith('fr')) return 'fr'
  return 'en'
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

function formatDisplayDate(date: Date, locale: 'fr' | 'en'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return formatter.format(date)
}

function buildTenantReminderCopy(
  locale: 'fr' | 'en',
  payload: {
    propertyTitle: string
    dueDate: Date
    amount: number
    daysBefore: ReminderDayOffset
    recipientName: string | null
  }
): ReminderCopy {
  const dueDateLabel = formatDisplayDate(payload.dueDate, locale)
  const amountLabel = formatAmount(payload.amount)
  const dayBadge = `J-${payload.daysBefore}`
  const displayName = payload.recipientName?.trim() || (locale === 'fr' ? 'Locataire' : 'Tenant')

  if (locale === 'fr') {
    return {
      title: `Rappel de paiement ${dayBadge}`,
      inAppMessage: `Votre loyer (${amountLabel}) pour ${payload.propertyTitle} est attendu le ${dueDateLabel}.`,
      emailSubject: `ImmoSaaS - Rappel loyer ${dayBadge}`,
      emailBody: `Bonjour ${displayName},\n\nVotre loyer de ${amountLabel} pour ${payload.propertyTitle} est attendu le ${dueDateLabel} (${dayBadge}).\nMerci d'anticiper votre paiement.\n\nImmoSaaS`,
      smsBody: `ImmoSaaS: Rappel ${dayBadge}, loyer ${amountLabel} pour ${payload.propertyTitle} attendu le ${dueDateLabel}.`,
      whatsappBody: `ImmoSaaS: Rappel ${dayBadge}, loyer ${amountLabel} pour ${payload.propertyTitle} attendu le ${dueDateLabel}.`,
    }
  }

  return {
    title: `Payment reminder ${dayBadge}`,
    inAppMessage: `Your rent (${amountLabel}) for ${payload.propertyTitle} is due on ${dueDateLabel}.`,
    emailSubject: `ImmoSaaS - Rent reminder ${dayBadge}`,
    emailBody: `Hello ${displayName},\n\nYour rent payment of ${amountLabel} for ${payload.propertyTitle} is due on ${dueDateLabel} (${dayBadge}).\nPlease plan your payment ahead.\n\nImmoSaaS`,
    smsBody: `ImmoSaaS: Reminder ${dayBadge}, rent ${amountLabel} for ${payload.propertyTitle} due on ${dueDateLabel}.`,
    whatsappBody: `ImmoSaaS: Reminder ${dayBadge}, rent ${amountLabel} for ${payload.propertyTitle} due on ${dueDateLabel}.`,
  }
}

function buildManagerReminderCopy(
  locale: 'fr' | 'en',
  payload: {
    propertyTitle: string
    dueDate: Date
    amount: number
    daysBefore: ReminderDayOffset
    recipientName: string | null
    tenantName: string | null
  }
): ReminderCopy {
  const dueDateLabel = formatDisplayDate(payload.dueDate, locale)
  const amountLabel = formatAmount(payload.amount)
  const dayBadge = `J-${payload.daysBefore}`
  const managerName = payload.recipientName?.trim() || (locale === 'fr' ? 'Manager' : 'Manager')
  const tenantName = payload.tenantName?.trim() || (locale === 'fr' ? 'locataire' : 'tenant')

  if (locale === 'fr') {
    return {
      title: `Suivi loyer ${dayBadge}`,
      inAppMessage: `Le loyer de ${tenantName} (${amountLabel}) pour ${payload.propertyTitle} est attendu le ${dueDateLabel}.`,
      emailSubject: `ImmoSaaS - Suivi loyer ${dayBadge}`,
      emailBody: `Bonjour ${managerName},\n\nLe loyer de ${tenantName} (${amountLabel}) pour ${payload.propertyTitle} est attendu le ${dueDateLabel} (${dayBadge}).\n\nImmoSaaS`,
      smsBody: `ImmoSaaS: ${tenantName} - loyer ${amountLabel} (${payload.propertyTitle}) attendu le ${dueDateLabel} (${dayBadge}).`,
      whatsappBody: `ImmoSaaS: ${tenantName} - loyer ${amountLabel} (${payload.propertyTitle}) attendu le ${dueDateLabel} (${dayBadge}).`,
    }
  }

  return {
    title: `Rent follow-up ${dayBadge}`,
    inAppMessage: `${tenantName}'s rent (${amountLabel}) for ${payload.propertyTitle} is due on ${dueDateLabel}.`,
    emailSubject: `ImmoSaaS - Rent follow-up ${dayBadge}`,
    emailBody: `Hello ${managerName},\n\n${tenantName}'s rent (${amountLabel}) for ${payload.propertyTitle} is due on ${dueDateLabel} (${dayBadge}).\n\nImmoSaaS`,
    smsBody: `ImmoSaaS: ${tenantName} rent ${amountLabel} (${payload.propertyTitle}) due on ${dueDateLabel} (${dayBadge}).`,
    whatsappBody: `ImmoSaaS: ${tenantName} rent ${amountLabel} (${payload.propertyTitle}) due on ${dueDateLabel} (${dayBadge}).`,
  }
}

async function postReminderWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REMINDER_WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}

async function deliverChannels(
  input: {
    reminderKey: string
    recipient: Recipient
    copy: ReminderCopy
    channels?: ReminderDeliveryChannel[]
    ignoreUserPreferences?: boolean
    correlationId?: string
    route?: string
  }
): Promise<ReminderChannelMetrics> {
  const emailWebhookUrl =
    process.env.PAYMENT_REMINDER_EMAIL_WEBHOOK_URL?.trim() ||
    process.env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim() ||
    null
  const smsWebhookUrl =
    process.env.PAYMENT_REMINDER_SMS_WEBHOOK_URL?.trim() ||
    process.env.NOTIFICATION_SMS_WEBHOOK_URL?.trim() ||
    null
  const whatsappWebhookUrl =
    process.env.PAYMENT_REMINDER_WHATSAPP_WEBHOOK_URL?.trim() ||
    process.env.NOTIFICATION_WHATSAPP_WEBHOOK_URL?.trim() ||
    null
  const desiredChannels = new Set<ReminderDeliveryChannel>(input.channels ?? ['EMAIL', 'SMS', 'WHATSAPP'])

  const metrics: ReminderChannelMetrics = {
    emailSent: 0,
    emailSkipped: 0,
    smsSent: 0,
    smsSkipped: 0,
    whatsappSent: 0,
    whatsappSkipped: 0,
    failures: 0,
  }

  const canSendEmail = input.ignoreUserPreferences || input.recipient.notifyEmail
  const canSendSms = input.ignoreUserPreferences || input.recipient.notifySms
  const canSendWhatsapp = input.ignoreUserPreferences || input.recipient.notifySms

  if (desiredChannels.has('EMAIL') && canSendEmail && input.recipient.email) {
    if (!emailWebhookUrl) {
      metrics.emailSkipped += 1
    } else {
      const emailResult = await postReminderWebhook(emailWebhookUrl, {
        channel: 'email',
        reminderKey: input.reminderKey,
        to: input.recipient.email,
        subject: input.copy.emailSubject,
        message: input.copy.emailBody,
      })

      if (emailResult.ok) {
        metrics.emailSent += 1
      } else {
        metrics.failures += 1
        await createSystemLog({
          action: 'PAYMENT_REMINDER_EMAIL_FAILED',
          targetType: 'USER',
          targetId: input.recipient.id,
          correlationId: input.correlationId,
          route: input.route,
          details: `reminderKey=${input.reminderKey};reason=${emailResult.reason}`,
        })
      }
    }
  } else if (desiredChannels.has('EMAIL')) {
    metrics.emailSkipped += 1
  }

  if (desiredChannels.has('SMS') && canSendSms && input.recipient.phone) {
    if (!smsWebhookUrl) {
      metrics.smsSkipped += 1
    } else {
      const smsResult = await postReminderWebhook(smsWebhookUrl, {
        channel: 'sms',
        reminderKey: input.reminderKey,
        to: input.recipient.phone,
        message: input.copy.smsBody,
      })

      if (smsResult.ok) {
        metrics.smsSent += 1
      } else {
        metrics.failures += 1
        await createSystemLog({
          action: 'PAYMENT_REMINDER_SMS_FAILED',
          targetType: 'USER',
          targetId: input.recipient.id,
          correlationId: input.correlationId,
          route: input.route,
          details: `reminderKey=${input.reminderKey};reason=${smsResult.reason}`,
        })
      }
    }
  } else if (desiredChannels.has('SMS')) {
    metrics.smsSkipped += 1
  }

  if (desiredChannels.has('WHATSAPP') && canSendWhatsapp && input.recipient.phone) {
    if (!whatsappWebhookUrl) {
      metrics.whatsappSkipped += 1
    } else {
      const whatsappResult = await postReminderWebhook(whatsappWebhookUrl, {
        channel: 'whatsapp',
        reminderKey: input.reminderKey,
        to: input.recipient.phone,
        message: input.copy.whatsappBody,
      })

      if (whatsappResult.ok) {
        metrics.whatsappSent += 1
      } else {
        metrics.failures += 1
        await createSystemLog({
          action: 'PAYMENT_REMINDER_WHATSAPP_FAILED',
          targetType: 'USER',
          targetId: input.recipient.id,
          correlationId: input.correlationId,
          route: input.route,
          details: `reminderKey=${input.reminderKey};reason=${whatsappResult.reason}`,
        })
      }
    }
  } else if (desiredChannels.has('WHATSAPP')) {
    metrics.whatsappSkipped += 1
  }

  return metrics
}

function hasPaymentInDueWindow(
  candidate: ReminderCandidate,
  paymentsByContract: Map<string, Date[]>
): boolean {
  const payments = paymentsByContract.get(candidate.contractId)
  if (!payments || payments.length === 0) return false

  const rangeStart = candidate.previousDueDate.getTime()
  const rangeEndExclusive = addUtcDays(candidate.dueDate, 1).getTime()

  return payments.some((paymentDate) => {
    const timestamp = paymentDate.getTime()
    return timestamp >= rangeStart && timestamp < rangeEndExclusive
  })
}

export async function sendManualPaymentReminder(input: {
  contractId: string
  daysBefore: ReminderDayOffset
  channels?: ReminderDeliveryChannel[]
  correlationId?: string
  route?: string
}): Promise<ManualPaymentReminderResult> {
  const now = new Date()
  const nowDay = toUtcDayStart(now)

  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    select: {
      id: true,
      status: true,
      contractType: true,
      startDate: true,
      endDate: true,
      rentAmount: true,
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          preferredLanguage: true,
          notifyEmail: true,
          notifySms: true,
        },
      },
      property: {
        select: {
          title: true,
          managerId: true,
        },
      },
    },
  })

  if (!contract) {
    throw new Error('CONTRACT_NOT_FOUND')
  }

  if (contract.status !== 'ACTIVE') {
    throw new Error('CONTRACT_NOT_ACTIVE')
  }

  const contractEndDay = toUtcDayStart(contract.endDate)
  if (contractEndDay < nowDay) {
    throw new Error('CONTRACT_EXPIRED')
  }

  const nextDueDate = resolveNextDueDate(contract.startDate, now)
  if (nextDueDate > contractEndDay) {
    throw new Error('CONTRACT_EXPIRED')
  }

  if (contract.contractType === 'RENTAL') {
    const nextDueDateEnd = addUtcDays(nextDueDate, 1)
    const paidInstallment = await prisma.contractInstallment.findFirst({
      where: {
        contractId: contract.id,
        dueDate: {
          gte: nextDueDate,
          lt: nextDueDateEnd,
        },
        OR: [{ status: 'PAID' }, { paidAt: { not: null } }],
      },
      select: { id: true },
    })

    if (paidInstallment) {
      throw new Error('CONTRACT_DUE_ALREADY_PAID')
    }
  }

  const dueDateKey = formatUtcDate(nextDueDate)
  const reminderKey = `${contract.id}:${dueDateKey}:MANUAL:J-${input.daysBefore}`
  const tenantLocale = normalizeLocale(contract.tenant.preferredLanguage)

  const tenantCopy = buildTenantReminderCopy(tenantLocale, {
    propertyTitle: contract.property.title,
    dueDate: nextDueDate,
    amount: contract.rentAmount,
    daysBefore: input.daysBefore,
    recipientName: contract.tenant.name,
  })

  const persisted = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-reminder-manual:${reminderKey}`}))`

    const duplicateWindowStart = new Date(Date.now() - 2 * 60 * 1000)
    const duplicate = await tx.systemLog.findFirst({
      where: {
        action: 'PAYMENT_REMINDER_MANUAL_SENT',
        targetType: 'PAYMENT_REMINDER',
        targetId: reminderKey,
        createdAt: { gte: duplicateWindowStart },
      },
      select: { id: true },
    })

    if (duplicate) {
      return { created: false }
    }

    await tx.notification.create({
      data: {
        userId: contract.tenant.id,
        type: 'PAYMENT_REMINDER',
        title: tenantCopy.title,
        message: tenantCopy.inAppMessage,
        paymentId: null,
      },
    })

    await tx.systemLog.create({
      data: {
        action: 'PAYMENT_REMINDER_MANUAL_SENT',
        targetType: 'PAYMENT_REMINDER',
        targetId: reminderKey,
        details: `contractId=${contract.id};tenantId=${contract.tenant.id};managerId=${contract.property.managerId ?? 'none'};dueDate=${dueDateKey};daysBefore=${input.daysBefore};channels=${(input.channels ?? ['EMAIL', 'SMS', 'WHATSAPP']).join(',')};correlationId=${input.correlationId ?? 'none'};route=${input.route ?? 'none'}`,
      },
    })

    return { created: true }
  })

  if (!persisted.created) {
    return {
      reminderKey,
      dueDate: dueDateKey,
      daysBefore: input.daysBefore,
      inAppNotificationSent: false,
      emailSent: 0,
      emailSkipped: 0,
      smsSent: 0,
      smsSkipped: 0,
      whatsappSent: 0,
      whatsappSkipped: 0,
      failures: 0,
    }
  }

  const channels: ReminderDeliveryChannel[] =
    input.channels && input.channels.length > 0 ? input.channels : ['EMAIL', 'SMS', 'WHATSAPP']
  const metrics = await deliverChannels({
    reminderKey,
    recipient: {
      id: contract.tenant.id,
      name: contract.tenant.name,
      email: contract.tenant.email,
      phone: contract.tenant.phone,
      preferredLanguage: contract.tenant.preferredLanguage,
      notifyEmail: contract.tenant.notifyEmail,
      notifySms: contract.tenant.notifySms,
    },
    copy: tenantCopy,
    channels,
    ignoreUserPreferences: true,
    correlationId: input.correlationId,
    route: input.route,
  })

  return {
    reminderKey,
    dueDate: dueDateKey,
    daysBefore: input.daysBefore,
    inAppNotificationSent: true,
    emailSent: metrics.emailSent,
    emailSkipped: metrics.emailSkipped,
    smsSent: metrics.smsSent,
    smsSkipped: metrics.smsSkipped,
    whatsappSent: metrics.whatsappSent,
    whatsappSkipped: metrics.whatsappSkipped,
    failures: metrics.failures,
  }
}

export async function sendDailyPaymentReminders(input?: {
  runDate?: Date
  correlationId?: string
  route?: string
}): Promise<PaymentReminderRunSummary> {
  const today = toUtcDayStart(input?.runDate ?? new Date())
  const maxOffset = Math.max(...REMINDER_DAY_OFFSETS)
  const horizon = addUtcDays(today, maxOffset)

  const summary: PaymentReminderRunSummary = {
    runDate: formatUtcDate(today),
    scannedContracts: 0,
    dueCandidates: 0,
    remindersSent: 0,
    duplicateSkipped: 0,
    paidSkipped: 0,
    inAppNotifications: 0,
    emailSent: 0,
    emailSkipped: 0,
    smsSent: 0,
    smsSkipped: 0,
    whatsappSent: 0,
    whatsappSkipped: 0,
    failures: 0,
  }

  const contracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: horizon },
      endDate: { gte: today },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      rentAmount: true,
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          preferredLanguage: true,
          notifyEmail: true,
          notifySms: true,
        },
      },
      property: {
        select: {
          title: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              preferredLanguage: true,
              notifyEmail: true,
              notifySms: true,
            },
          },
        },
      },
    },
  })

  summary.scannedContracts = contracts.length
  if (contracts.length === 0) {
    return summary
  }

  const candidates: ReminderCandidate[] = []
  for (const contract of contracts) {
    const contractStartDay = toUtcDayStart(contract.startDate)
    const contractEndDay = toUtcDayStart(contract.endDate)
    for (const daysBefore of REMINDER_DAY_OFFSETS) {
      const targetDate = addUtcDays(today, daysBefore)
      const dueDate = resolveDueDateForMonth(contract.startDate, targetDate)

      if (!isSameUtcDay(dueDate, targetDate)) {
        continue
      }
      if (dueDate < contractStartDay || dueDate > contractEndDay) {
        continue
      }

      const previousDueDate = resolveDueDateForMonth(contract.startDate, addUtcMonths(dueDate, -1))
      candidates.push({
        contractId: contract.id,
        rentAmount: contract.rentAmount,
        propertyTitle: contract.property.title,
        dueDate,
        previousDueDate,
        daysBefore,
        tenant: {
          id: contract.tenant.id,
          name: contract.tenant.name,
          email: contract.tenant.email,
          phone: contract.tenant.phone,
          preferredLanguage: contract.tenant.preferredLanguage,
          notifyEmail: contract.tenant.notifyEmail,
          notifySms: contract.tenant.notifySms,
        },
        manager: contract.property.manager
          ? {
              id: contract.property.manager.id,
              name: contract.property.manager.name,
              email: contract.property.manager.email,
              phone: contract.property.manager.phone,
              preferredLanguage: contract.property.manager.preferredLanguage,
              notifyEmail: contract.property.manager.notifyEmail,
              notifySms: contract.property.manager.notifySms,
            }
          : null,
      })
    }
  }

  summary.dueCandidates = candidates.length
  if (candidates.length === 0) {
    return summary
  }

  let paymentWindowStart = candidates[0].previousDueDate
  let paymentWindowEnd = addUtcDays(candidates[0].dueDate, 1)

  for (const candidate of candidates) {
    if (candidate.previousDueDate < paymentWindowStart) {
      paymentWindowStart = candidate.previousDueDate
    }
    const candidateEnd = addUtcDays(candidate.dueDate, 1)
    if (candidateEnd > paymentWindowEnd) {
      paymentWindowEnd = candidateEnd
    }
  }

  const contractIds = [...new Set(candidates.map((candidate) => candidate.contractId))]
  const completedPayments = await prisma.payment.findMany({
    where: {
      contractId: { in: contractIds },
      status: 'COMPLETED',
      createdAt: {
        gte: paymentWindowStart,
        lt: paymentWindowEnd,
      },
    },
    select: {
      contractId: true,
      createdAt: true,
    },
  })

  const paidInstallments = await prisma.contractInstallment.findMany({
    where: {
      contractId: { in: contractIds },
      dueDate: {
        gte: paymentWindowStart,
        lt: paymentWindowEnd,
      },
      OR: [{ status: 'PAID' }, { paidAt: { not: null } }],
    },
    select: {
      contractId: true,
      dueDate: true,
    },
  })

  const paymentsByContract = new Map<string, Date[]>()
  for (const payment of completedPayments) {
    const entries = paymentsByContract.get(payment.contractId) ?? []
    entries.push(toUtcDayStart(payment.createdAt))
    paymentsByContract.set(payment.contractId, entries)
  }

  const paidInstallmentKeys = new Set(
    paidInstallments.map((item) => `${item.contractId}:${formatUtcDate(item.dueDate)}`)
  )

  for (const candidate of candidates) {
    const candidateDueKey = `${candidate.contractId}:${formatUtcDate(candidate.dueDate)}`
    if (paidInstallmentKeys.has(candidateDueKey)) {
      summary.paidSkipped += 1
      continue
    }

    if (hasPaymentInDueWindow(candidate, paymentsByContract)) {
      summary.paidSkipped += 1
      continue
    }

    const dueDateKey = formatUtcDate(candidate.dueDate)
    const reminderKey = `${candidate.contractId}:${dueDateKey}:J-${candidate.daysBefore}`

    const tenantLocale = normalizeLocale(candidate.tenant.preferredLanguage)
    const tenantCopy = buildTenantReminderCopy(tenantLocale, {
      propertyTitle: candidate.propertyTitle,
      dueDate: candidate.dueDate,
      amount: candidate.rentAmount,
      daysBefore: candidate.daysBefore,
      recipientName: candidate.tenant.name,
    })

    const managerLocale = normalizeLocale(candidate.manager?.preferredLanguage)
    const managerCopy =
      candidate.manager && candidate.manager.id !== candidate.tenant.id
        ? buildManagerReminderCopy(managerLocale, {
            propertyTitle: candidate.propertyTitle,
            dueDate: candidate.dueDate,
            amount: candidate.rentAmount,
            daysBefore: candidate.daysBefore,
            recipientName: candidate.manager.name,
            tenantName: candidate.tenant.name,
          })
        : null

    try {
      const persisted = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-reminder:${reminderKey}`}))`

        const existing = await tx.systemLog.findFirst({
          where: {
            action: 'PAYMENT_REMINDER_SENT',
            targetType: 'PAYMENT_REMINDER',
            targetId: reminderKey,
          },
          select: { id: true },
        })
        if (existing) {
          return { created: false, inAppNotifications: 0 }
        }

        const notifications = [
          {
            userId: candidate.tenant.id,
            type: 'PAYMENT_REMINDER',
            title: tenantCopy.title,
            message: tenantCopy.inAppMessage,
            paymentId: null,
          },
        ]

        if (candidate.manager && managerCopy && candidate.manager.id !== candidate.tenant.id) {
          notifications.push({
            userId: candidate.manager.id,
            type: 'PAYMENT_REMINDER',
            title: managerCopy.title,
            message: managerCopy.inAppMessage,
            paymentId: null,
          })
        }

        const createManyResult = await tx.notification.createMany({
          data: notifications,
        })

        await tx.systemLog.create({
          data: {
            action: 'PAYMENT_REMINDER_SENT',
            targetType: 'PAYMENT_REMINDER',
            targetId: reminderKey,
            details: `contractId=${candidate.contractId};dueDate=${dueDateKey};daysBefore=${candidate.daysBefore};month=${getMonthKey(candidate.dueDate)}`,
          },
        })

        return {
          created: true,
          inAppNotifications: createManyResult.count,
        }
      })

      if (!persisted.created) {
        summary.duplicateSkipped += 1
        continue
      }

      summary.remindersSent += 1
      summary.inAppNotifications += persisted.inAppNotifications

      const tenantMetrics = await deliverChannels({
        reminderKey,
        recipient: candidate.tenant,
        copy: tenantCopy,
        correlationId: input?.correlationId,
        route: input?.route,
      })

      summary.emailSent += tenantMetrics.emailSent
      summary.emailSkipped += tenantMetrics.emailSkipped
      summary.smsSent += tenantMetrics.smsSent
      summary.smsSkipped += tenantMetrics.smsSkipped
      summary.whatsappSent += tenantMetrics.whatsappSent
      summary.whatsappSkipped += tenantMetrics.whatsappSkipped
      summary.failures += tenantMetrics.failures

      if (candidate.manager && managerCopy && candidate.manager.id !== candidate.tenant.id) {
        const managerMetrics = await deliverChannels({
          reminderKey,
          recipient: candidate.manager,
          copy: managerCopy,
          correlationId: input?.correlationId,
          route: input?.route,
        })

        summary.emailSent += managerMetrics.emailSent
        summary.emailSkipped += managerMetrics.emailSkipped
        summary.smsSent += managerMetrics.smsSent
        summary.smsSkipped += managerMetrics.smsSkipped
        summary.whatsappSent += managerMetrics.whatsappSent
        summary.whatsappSkipped += managerMetrics.whatsappSkipped
        summary.failures += managerMetrics.failures
      }
    } catch (error) {
      summary.failures += 1
      await createSystemLog({
        action: 'PAYMENT_REMINDER_PROCESSING_FAILED',
        targetType: 'PAYMENT_REMINDER',
        targetId: reminderKey,
        correlationId: input?.correlationId,
        route: input?.route,
        details: `contractId=${candidate.contractId};error=${error instanceof Error ? error.message : 'unknown'}`,
      })
    }
  }

  return summary
}
