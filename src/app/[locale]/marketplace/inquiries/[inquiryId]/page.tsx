import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth'
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader'
import { PublicInquiryChat } from '@/components/marketplace/PublicInquiryChat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SearchParams = {
  guestToken?: string | string[]
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function MarketplaceInquiryConversationPage(props: {
  params: Promise<{ locale: string; inquiryId: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale, inquiryId } = await props.params
  const searchParams = await props.searchParams
  const guestToken = firstValue(searchParams.guestToken).trim()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  return (
    <div className="min-h-screen bg-background text-primary">
      <MarketplaceHeader locale={locale} isAuthenticated={Boolean(user)} />
      <main className="container-app py-8">
        <PublicInquiryChat inquiryId={inquiryId} guestToken={guestToken || undefined} currentUserId={user?.id ?? null} />
      </main>
    </div>
  )
}
