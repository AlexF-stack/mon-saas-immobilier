'use client'

import { PropertyForm } from './PropertyForm'

type NewPropertyFormProps = {
  locale?: string
  dashboardPathPrefix?: string
}

export function NewPropertyForm({ locale, dashboardPathPrefix }: NewPropertyFormProps) {
  return <PropertyForm locale={locale} dashboardPathPrefix={dashboardPathPrefix} />
}
