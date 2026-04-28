import { createHash, randomBytes } from 'crypto'

const GUEST_ACCESS_TTL_DAYS = 14

export function createGuestInquiryAccessToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashGuestInquiryAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function buildGuestInquiryAccessExpiry(from = new Date()): Date {
  const expiresAt = new Date(from)
  expiresAt.setDate(expiresAt.getDate() + GUEST_ACCESS_TTL_DAYS)
  return expiresAt
}

export function isGuestInquiryAccessExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= Date.now()
}
