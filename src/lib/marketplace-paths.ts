export function getBuyerInquiriesDashboardPath(locale?: string, inquiryId?: string | null) {
  const prefix = locale ? `/${locale}` : ''
  const base = `${prefix}/dashboard/marketplace/inquiries`
  if (!inquiryId) return base
  return `${base}?inquiryId=${encodeURIComponent(inquiryId)}`
}

export function getBuyerRegisterPathAfterInquiry(
  locale: string | undefined,
  inquiryId: string,
  email?: string
) {
  const prefix = locale ? `/${locale}` : ''
  const params = new URLSearchParams({
    pendingInquiry: inquiryId,
    profile: 'tenant',
  })
  if (email?.trim()) params.set('email', email.trim())
  return `${prefix}/register?${params.toString()}`
}
