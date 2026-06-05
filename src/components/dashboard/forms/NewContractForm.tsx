'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type PropertyOption = {
  id: string
  title: string
  status?: string
  offerType?: string
  price?: number
}

type TenantOption = {
  id: string
  name: string | null
  email: string
}

type InquiryPrefill = {
  id: string
  requesterName: string
  requesterEmail: string
  property: PropertyOption
}

type NewContractFormProps = {
  locale?: string
  dashboardPathPrefix?: string
}

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return errorPayload
  }

  if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
    return String(errorPayload[0].message)
  }

  if (status === 401) return 'Session expiree. Reconnectez-vous.'
  if (status === 403) return 'Acces refuse. Seul un proprietaire peut creer un bail.'
  if (status === 404) return 'Ressource introuvable.'
  if (status === 409) return 'Cette propriete est deja occupee ou sous bail actif.'

  return fallback
}

export function NewContractForm({ locale, dashboardPathPrefix }: NewContractFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inquiryId = searchParams.get('inquiryId')?.trim() ?? ''
  const requestedPropertyId = searchParams.get('propertyId')?.trim() ?? ''
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [inquiryPrefill, setInquiryPrefill] = useState<InquiryPrefill | null>(null)
  const [propertyId, setPropertyId] = useState<string>('')
  const [tenantId, setTenantId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rentAmount, setRentAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [error, setError] = useState('')
  const dashboardPath = dashboardPathPrefix ?? (locale ? `/${locale}/dashboard` : '/dashboard')

  useEffect(() => {
    let isCancelled = false

    async function loadOptions() {
      setLoadingOptions(true)
      setError('')

      try {
        const [propertiesRes, tenantsRes, inquiryRes] = await Promise.all([
          fetch('/api/properties?status=AVAILABLE', { credentials: 'include' }),
          fetch('/api/tenants', { credentials: 'include' }),
          inquiryId
            ? fetch(`/api/marketplace/inquiries/${inquiryId}`, { credentials: 'include' })
            : Promise.resolve(null),
        ])

        if (!propertiesRes.ok || !tenantsRes.ok) {
          const failing = !propertiesRes.ok ? propertiesRes : tenantsRes
          const payload = await failing.json().catch(() => ({}))
          if (!isCancelled) {
            setError(
              toErrorMessage(failing.status, payload?.error, 'Impossible de charger les options.')
            )
          }
          return
        }

        const [propertiesPayload, tenantsPayload] = await Promise.all([
          propertiesRes.json().catch(() => []),
          tenantsRes.json().catch(() => []),
        ])
        const inquiryPayload =
          inquiryRes && inquiryRes.ok ? ((await inquiryRes.json().catch(() => null)) as InquiryPrefill | null) : null

        if (!isCancelled) {
          const rawProperties = Array.isArray(propertiesPayload) ? propertiesPayload as PropertyOption[] : []
          let availableProperties = rawProperties.filter((property) => property.status === 'AVAILABLE')
          if (
            inquiryPayload?.property &&
            inquiryPayload.property.status === 'AVAILABLE' &&
            !availableProperties.some((property) => property.id === inquiryPayload.property.id)
          ) {
            availableProperties = [inquiryPayload.property, ...availableProperties]
          }
          const tenantOptions = Array.isArray(tenantsPayload) ? tenantsPayload as TenantOption[] : []
          setProperties(availableProperties)
          setTenants(tenantOptions)

          if (inquiryPayload) {
            setInquiryPrefill(inquiryPayload)
            setPropertyId(inquiryPayload.property.id)
            if (typeof inquiryPayload.property.price === 'number') {
              setRentAmount(String(inquiryPayload.property.price))
              if (inquiryPayload.property.offerType === 'SALE') {
                setDepositAmount(String(Math.round(inquiryPayload.property.price * 0.1)))
              }
            }

            const matchingTenant = tenantOptions.find(
              (tenant) => tenant.email.toLowerCase() === inquiryPayload.requesterEmail.toLowerCase()
            )
            if (matchingTenant) {
              setTenantId(matchingTenant.id)
            }
          } else if (requestedPropertyId) {
            setPropertyId(requestedPropertyId)
          }
        }
      } catch {
        if (!isCancelled) {
          setError('Erreur reseau lors du chargement des options.')
        }
      } finally {
        if (!isCancelled) {
          setLoadingOptions(false)
        }
      }
    }

    void loadOptions()

    return () => {
      isCancelled = true
    }
  }, [inquiryId, requestedPropertyId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!propertyId || !tenantId) {
      setError('Veuillez selectionner un bien et un locataire.')
      return
    }

    setLoading(true)

    const formData = new FormData(event.currentTarget)
    const data = {
      propertyId,
      tenantId,
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      rentAmount: formData.get('rentAmount'),
      depositAmount: formData.get('depositAmount'),
    }

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push(`${dashboardPath}/contracts`)
        router.refresh()
        return
      }

      const payload = await res.json().catch(() => ({}))
      setError(toErrorMessage(res.status, payload?.error, 'Erreur lors de la creation du bail.'))
    } catch {
      setError('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  const selectedProperty = properties.find((property) => property.id === propertyId)
  const amountLabel = selectedProperty?.offerType === 'SALE' ? 'Montant de vente' : 'Montant contractuel'
  const depositLabel = selectedProperty?.offerType === 'SALE' ? 'Acompte initial' : 'Caution'
  const emptyPropertyLabel = 'Aucun bien disponible'

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Nouveau contrat</CardTitle>
          <CardDescription>Associez un bien de location ou de vente a un locataire/acheteur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          {loadingOptions && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden>
              <div className="h-10 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
            </div>
          )}
          {inquiryPrefill && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              Demande liee : {inquiryPrefill.requesterName} ({inquiryPrefill.requesterEmail})
              {!tenantId ? (
                <span>
                  {' '}
                  Aucun locataire visible avec cet email (inscrivez-le ou associez son compte).{' '}
                  <Link
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={`${dashboardPath}/tenants/new?name=${encodeURIComponent(inquiryPrefill.requesterName)}&email=${encodeURIComponent(inquiryPrefill.requesterEmail)}&inquiryId=${encodeURIComponent(inquiryPrefill.id)}`}
                  >
                    Associer le locataire
                  </Link>
                </span>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Bien immobilier</Label>
              <Select
                name="propertyId"
                value={propertyId}
                onValueChange={setPropertyId}
                disabled={loadingOptions}
              >
                <SelectTrigger id="propertyId">
                  <SelectValue placeholder="Choisir un bien" />
                </SelectTrigger>
                <SelectContent>
                  {properties.length > 0 ? (
                    properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title} ({property.offerType === 'SALE' ? 'Vente' : 'Location'})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>
                      {emptyPropertyLabel}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantId">Locataire</Label>
              <Select
                name="tenantId"
                value={tenantId}
                onValueChange={setTenantId}
                disabled={loadingOptions}
              >
                <SelectTrigger id="tenantId">
                  <SelectValue placeholder="Choisir un locataire" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length > 0 ? (
                    tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name || tenant.email}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>
                      Aucun locataire
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de debut</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Date de fin</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rentAmount">{amountLabel}</Label>
              <Input
                id="rentAmount"
                name="rentAmount"
                type="number"
                min="1"
                value={rentAmount}
                onChange={(event) => setRentAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositAmount">{depositLabel}</Label>
              <Input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min="0"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800">
          <Button asChild variant="outline" disabled={loading || loadingOptions}>
            <Link href={`${dashboardPath}/contracts`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={loading || loadingOptions}>
            {loading ? 'Creation...' : 'Creer le contrat'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
