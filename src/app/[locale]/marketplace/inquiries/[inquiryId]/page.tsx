import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { getBuyerInquiriesDashboardPath } from '@/lib/marketplace-paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function MarketplaceInquiryConversationPage(props: {
  params: Promise<{ locale: string; inquiryId: string }>
}) {
  const { locale, inquiryId } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login?pendingInquiry=${encodeURIComponent(inquiryId)}&profile=tenant`)
  }

  redirect(getBuyerInquiriesDashboardPath(locale, inquiryId))
}
