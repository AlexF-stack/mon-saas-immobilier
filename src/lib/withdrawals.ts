import type { SystemLog } from '@prisma/client'

export const WITHDRAWAL_ACTION = 'WITHDRAWAL_EVENT'
export const WITHDRAWAL_TARGET_TYPE = 'WITHDRAWAL'

export const WITHDRAWAL_STATUSES = ['REQUESTED', 'APPROVED', 'PAID', 'REJECTED'] as const
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number]

export const WITHDRAWAL_METHODS = ['MOMO', 'BANK', 'CASHOUT'] as const
export type WithdrawalMethod = (typeof WITHDRAWAL_METHODS)[number]

type WithdrawalDetails = {
  status: WithdrawalStatus
  amount: number
  method: WithdrawalMethod
  accountLabel: string
  accountNumberMasked: string
  note?: string
  availableBefore: number
  availableAfter: number
  ip?: string
  userAgent?: string
}

type WithdrawalLogLike = Pick<
  SystemLog,
  'id' | 'actorId' | 'actorEmail' | 'actorRole' | 'targetId' | 'details' | 'createdAt'
>

export type WithdrawalRecord = {
  withdrawalId: string
  actorId: string | null
  actorEmail: string | null
  actorRole: string | null
  amount: number
  method: WithdrawalMethod
  accountLabel: string
  accountNumberMasked: string
  note?: string
  status: WithdrawalStatus
  requestedAt: Date
  updatedAt: Date
  ip?: string
  userAgent?: string
}

const RESERVED_STATUSES = new Set<WithdrawalStatus>(['REQUESTED', 'APPROVED', 'PAID'])

export function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return WITHDRAWAL_STATUSES.includes(value as WithdrawalStatus)
}

export function isWithdrawalMethod(value: string): value is WithdrawalMethod {
  return WITHDRAWAL_METHODS.includes(value as WithdrawalMethod)
}

export function parseWithdrawalDetails(details: string | null | undefined): WithdrawalDetails | null {
  if (!details) return null

  try {
    const parsed = JSON.parse(details) as Partial<WithdrawalDetails>
    if (
      typeof parsed.status !== 'string' ||
      !isWithdrawalStatus(parsed.status) ||
      typeof parsed.amount !== 'number' ||
      !Number.isFinite(parsed.amount) ||
      parsed.amount <= 0 ||
      typeof parsed.method !== 'string' ||
      !isWithdrawalMethod(parsed.method) ||
      typeof parsed.accountLabel !== 'string' ||
      typeof parsed.accountNumberMasked !== 'string'
    ) {
      return null
    }

    const result: WithdrawalDetails = {
      status: parsed.status,
      amount: parsed.amount,
      method: parsed.method,
      accountLabel: parsed.accountLabel,
      accountNumberMasked: parsed.accountNumberMasked,
      availableBefore:
        typeof parsed.availableBefore === 'number' && Number.isFinite(parsed.availableBefore)
          ? parsed.availableBefore
          : 0,
      availableAfter:
        typeof parsed.availableAfter === 'number' && Number.isFinite(parsed.availableAfter)
          ? parsed.availableAfter
          : 0,
    }

    if (typeof parsed.note === 'string' && parsed.note.trim()) {
      result.note = parsed.note.trim()
    }
    if (typeof parsed.ip === 'string' && parsed.ip.trim()) {
      result.ip = parsed.ip.trim()
    }
    if (typeof parsed.userAgent === 'string' && parsed.userAgent.trim()) {
      result.userAgent = parsed.userAgent.trim()
    }

    return result
  } catch {
    return null
  }
}

export function getLatestWithdrawalRecords(logs: WithdrawalLogLike[]): WithdrawalRecord[] {
  const grouped = new Map<string, Array<WithdrawalLogLike & { parsed: WithdrawalDetails }>>()

  for (const log of logs) {
    const withdrawalId = log.targetId?.trim()
    if (!withdrawalId) continue

    const parsed = parseWithdrawalDetails(log.details)
    if (!parsed) continue

    const list = grouped.get(withdrawalId) ?? []
    list.push({ ...log, parsed })
    grouped.set(withdrawalId, list)
  }

  const records: WithdrawalRecord[] = []
  for (const [withdrawalId, events] of grouped.entries()) {
    events.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    const first = events[0]
    const last = events[events.length - 1]

    records.push({
      withdrawalId,
      actorId: last.actorId,
      actorEmail: last.actorEmail,
      actorRole: last.actorRole,
      amount: last.parsed.amount,
      method: last.parsed.method,
      accountLabel: last.parsed.accountLabel,
      accountNumberMasked: last.parsed.accountNumberMasked,
      note: last.parsed.note,
      status: last.parsed.status,
      requestedAt: first.createdAt,
      updatedAt: last.createdAt,
      ip: last.parsed.ip,
      userAgent: last.parsed.userAgent,
    })
  }

  return records.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
}

export function sumReservedWithdrawals(records: WithdrawalRecord[]): number {
  return records.reduce((sum, record) => (RESERVED_STATUSES.has(record.status) ? sum + record.amount : sum), 0)
}

export function sumPaidWithdrawals(records: WithdrawalRecord[]): number {
  return records.reduce((sum, record) => (record.status === 'PAID' ? sum + record.amount : sum), 0)
}

export function sumDailyRequestedAmount(records: WithdrawalRecord[], dayStart: Date): number {
  return records.reduce((sum, record) => {
    if (record.requestedAt >= dayStart && RESERVED_STATUSES.has(record.status)) {
      return sum + record.amount
    }
    return sum
  }, 0)
}

export function countDailyRequested(records: WithdrawalRecord[], dayStart: Date): number {
  return records.reduce((count, record) => {
    if (record.requestedAt >= dayStart && RESERVED_STATUSES.has(record.status)) {
      return count + 1
    }
    return count
  }, 0)
}

export function canTransitionWithdrawalStatus(
  currentStatus: WithdrawalStatus,
  nextStatus: WithdrawalStatus
): boolean {
  if (currentStatus === 'REQUESTED') return nextStatus === 'APPROVED' || nextStatus === 'REJECTED'
  if (currentStatus === 'APPROVED') return nextStatus === 'PAID' || nextStatus === 'REJECTED'
  return false
}

export function maskAccountNumber(rawAccount: string): string {
  const cleaned = rawAccount.replace(/\s+/g, '').trim()
  if (!cleaned) return '****'
  const last4 = cleaned.slice(-4)
  const prefix = cleaned.length > 4 ? '*'.repeat(cleaned.length - 4) : ''
  return `${prefix}${last4}`
}
