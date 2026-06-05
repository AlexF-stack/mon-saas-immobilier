import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import {
  getBuyerInquiriesDashboardPath,
  getBuyerRegisterPathAfterInquiry,
} from '@/lib/marketplace-paths'

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
    redirect(getBuyerRegisterPathAfterInquiry(locale, inquiryId))
  }

  redirect(getBuyerInquiriesDashboardPath(locale, inquiryId))
}
