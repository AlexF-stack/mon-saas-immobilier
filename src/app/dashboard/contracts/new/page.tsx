import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { NewContractForm } from '@/components/dashboard/forms/NewContractForm'

export default async function NewContractPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nouveau contrat</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Generez un bail lie a un bien disponible et a un locataire.
        </p>
      </div>
      <NewContractForm dashboardPathPrefix="/dashboard" />
    </section>
  )
}
