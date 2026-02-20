import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { NewPropertyForm } from '@/components/dashboard/forms/NewPropertyForm'

export default async function NewPropertyPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'MANAGER') {
    forbidden()
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ajouter un bien</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Creez une nouvelle propriete et associez-la a votre portefeuille.
        </p>
      </div>
      <NewPropertyForm dashboardPathPrefix="/dashboard" />
    </section>
  )
}
