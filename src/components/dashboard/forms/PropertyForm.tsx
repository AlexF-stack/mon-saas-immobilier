'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type PropertyFormProps = {
  locale?: string
  dashboardPathPrefix?: string
  initialData?: {
    id: string
    title: string
    city: string | null
    address: string
    price: number
    description: string | null
    propertyType: string
    offerType: string
    status: string
  }
}

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return errorPayload
  }

  if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
    return String(errorPayload[0].message)
  }

  if (status === 401) return 'Session expirée. Reconnectez-vous.'
  if (status === 403) return 'Accès refusé.'
  if (status === 409) return 'Conflit détecté. Actualisez la page puis réessayez.'

  return fallback
}

export function PropertyForm({ locale, dashboardPathPrefix, initialData }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offerType, setOfferType] = useState<'RENT' | 'SALE'>((initialData?.offerType as 'RENT' | 'SALE') || 'RENT')
  const dashboardPath = dashboardPathPrefix ?? (locale ? `/${locale}/dashboard` : '/dashboard')
  const isEdit = Boolean(initialData)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      const url = isEdit ? `/api/properties/${initialData!.id}` : '/api/properties'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push(`${dashboardPath}/properties`)
        router.refresh()
        return
      }

      const payload = await res.json().catch(() => ({}))
      setError(toErrorMessage(res.status, payload?.error, `Erreur lors de la ${isEdit ? 'modification' : 'création'} du bien.`))
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{isEdit ? 'Modifier le bien' : 'Détails du bien'}</CardTitle>
          <CardDescription>
            {isEdit ? 'Mettez à jour les informations de votre propriété.' : 'Renseignez les informations du nouveau bien immobilier.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" defaultValue={initialData?.title} placeholder="Appartement T3 Centre Ville" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" defaultValue={initialData?.city ?? ''} placeholder="Ex: Cotonou" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" defaultValue={initialData?.address} placeholder="123 Rue de la Paix, Cotonou" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">{offerType === 'SALE' ? 'Prix de vente (FCFA)' : 'Loyer mensuel (FCFA)'}</Label>
            <Input id="price" name="price" type="number" min="1" defaultValue={initialData?.price} placeholder="150000" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offerType">Type d&apos;offre</Label>
            <Select
              name="offerType"
              value={offerType}
              onValueChange={(value) => setOfferType(value === 'SALE' ? 'SALE' : 'RENT')}
            >
              <SelectTrigger id="offerType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RENT">Location</SelectItem>
                <SelectItem value="SALE">Vente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyType">Type de bien</Label>
            <Select name="propertyType" defaultValue={initialData?.propertyType || "APARTMENT"}>
              <SelectTrigger id="propertyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APARTMENT">Appartement</SelectItem>
                <SelectItem value="HOUSE">Maison</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="LAND">Terrain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select name="status" defaultValue={initialData?.status || "AVAILABLE"}>
                    <SelectTrigger id="status">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="AVAILABLE">Disponible</SelectItem>
                        <SelectItem value="RENTED">Occupé</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initialData?.description ?? ''}
              placeholder="Description détaillée du bien..."
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800">
          <Button asChild variant="outline" disabled={loading}>
            <Link href={`${dashboardPath}/properties`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Traitement...' : isEdit ? 'Sauvegarder les modifications' : 'Créer le bien'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
