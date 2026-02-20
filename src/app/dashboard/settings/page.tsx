import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { getSettingsPageSnapshot } from '@/lib/settings'
import { SettingsWorkspace } from '@/components/dashboard/settings/SettingsWorkspace'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect('/login')
  }

  const snapshot = await getSettingsPageSnapshot(user.id, user.role)
  if (!snapshot) {
    redirect('/login')
  }

  return (
    <SettingsWorkspace
      profile={snapshot.profile}
      loginHistory={snapshot.loginHistory}
      wishlist={snapshot.wishlist}
      systemConfig={snapshot.systemConfig}
    />
  )
}
