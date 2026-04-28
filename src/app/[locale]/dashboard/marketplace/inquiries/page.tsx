import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { InquiryMessagesWorkspace } from '@/components/dashboard/marketplace/InquiryMessagesWorkspace'

export default async function MarketplaceInquiriesPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Messagerie visites</h1>
        <p className="text-sm text-secondary">
          Discutez entre demandeur et proprietaire autour des demandes de visite.
        </p>
      </div>
      <InquiryMessagesWorkspace currentUserId={user.id} />
    </section>
  )
}

