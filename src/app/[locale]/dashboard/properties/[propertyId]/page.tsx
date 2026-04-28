import { cookies } from 'next/headers'
import { forbidden, notFound, redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PropertyForm } from '@/components/dashboard/forms/PropertyForm'

export default async function EditPropertyPage(props: {
  params: Promise<{ locale: string; propertyId: string }>
}) {
  const { locale, propertyId } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  if (user.role === 'TENANT') {
    forbidden()
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      city: true,
      address: true,
      price: true,
      description: true,
      propertyType: true,
      offerType: true,
      status: true,
      managerId: true,
    },
  })

  if (!property) {
    notFound()
  }

  // Authorization check
  if (user.role !== 'ADMIN' && property.managerId !== user.id) {
    forbidden()
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Modifier le bien</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Modifiez les détails de votre propriété et mettez à jour son statut.
        </p>
      </div>
      <PropertyForm locale={locale} initialData={property} />
    </section>
  )
}
