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

type NewPropertyFormProps = {
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
  if (status === 403) return 'Acces refuse. Seul un proprietaire peut creer un bien.'
  if (status === 409) return 'Conflit detecte. Actualisez la page puis reessayez.'

  return fallback
}

export function NewPropertyForm({ locale, dashboardPathPrefix }: NewPropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dashboardPath = dashboardPathPrefix ?? (locale ? `/${locale}/dashboard` : '/dashboard')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const data = {
      title: formData.get('title'),
      city: formData.get('city'),
      address: formData.get('address'),
      price: formData.get('price'),
      description: formData.get('description'),
      propertyType: formData.get('propertyType'),
    }

    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push(`${dashboardPath}/properties`)
        router.refresh()
        return
      }

      const payload = await res.json().catch(() => ({}))
      setError(toErrorMessage(res.status, payload?.error, 'Erreur lors de la creation du bien.'))
    } catch {
      setError('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Details du bien</CardTitle>
          <CardDescription>Renseignez les informations du nouveau bien immobilier.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" placeholder="Appartement T3 Centre Ville" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" placeholder="Ex: Cotonou" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" placeholder="123 Rue de la Paix, Cotonou" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Loyer mensuel (FCFA)</Label>
            <Input id="price" name="price" type="number" min="1" placeholder="150000" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyType">Type de bien</Label>
            <Select name="propertyType" defaultValue="APARTMENT">
              <SelectTrigger id="propertyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APARTMENT">Appartement</SelectItem>
                <SelectItem value="HOUSE">Maison</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Description detaillee du bien..."
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800">
          <Button asChild variant="outline" disabled={loading}>
            <Link href={`${dashboardPath}/properties`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creation...' : 'Creer le bien'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
