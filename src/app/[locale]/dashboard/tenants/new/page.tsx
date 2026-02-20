import { cookies } from 'next/headers'
import { forbidden, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { NewTenantForm } from '@/components/dashboard/forms/NewTenantForm'

export default async function NewTenantPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    forbidden()
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nouveau locataire</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Creez un nouveau compte locataire et partagez ses identifiants initiaux.
        </p>
      </div>
      <NewTenantForm locale={locale} />
    </section>
  )
}
