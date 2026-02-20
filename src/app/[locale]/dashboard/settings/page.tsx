import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { getSettingsPageSnapshot } from '@/lib/settings'
import { SettingsWorkspace } from '@/components/dashboard/settings/SettingsWorkspace'

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const snapshot = await getSettingsPageSnapshot(user.id, user.role)
  if (!snapshot) {
    redirect(`/${locale}/login`)
  }

  return (
    <SettingsWorkspace
      locale={locale}
      profile={snapshot.profile}
      loginHistory={snapshot.loginHistory}
      wishlist={snapshot.wishlist}
      systemConfig={snapshot.systemConfig}
    />
  )
}
