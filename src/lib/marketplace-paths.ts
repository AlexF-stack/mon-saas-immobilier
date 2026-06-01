export function getBuyerInquiriesDashboardPath(locale?: string, inquiryId?: string | null) {
  const prefix = locale ? `/${locale}` : ''
  const base = `${prefix}/dashboard/marketplace/inquiries`
  if (!inquiryId) return base
  return `${base}?inquiryId=${encodeURIComponent(inquiryId)}`
}
