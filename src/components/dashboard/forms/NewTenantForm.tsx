'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type NewTenantFormProps = {
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
  if (status === 403) return 'Acces refuse.'
  if (status === 409) return 'Email deja utilise.'

  return fallback
}

export function NewTenantForm({ locale, dashboardPathPrefix }: NewTenantFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const dashboardPath = dashboardPathPrefix ?? (locale ? `/${locale}/dashboard` : '/dashboard')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(event.currentTarget)
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
    }

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const payload = await res.json().catch(() => ({}))

      if (res.ok) {
        if (payload.generatedPassword) {
          setSuccess(`Locataire cree. Mot de passe temporaire: ${payload.generatedPassword}`)
        } else {
          setSuccess('Locataire cree avec succes.')
        }

        setTimeout(() => {
          router.push(`${dashboardPath}/tenants`)
          router.refresh()
        }, 2200)
        return
      }

      setError(toErrorMessage(res.status, payload?.error, 'Erreur lors de la creation du locataire.'))
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
          <CardTitle>Nouveau locataire</CardTitle>
          <CardDescription>Creer un compte locataire et recuperer son acces initial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
              {success}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" name="name" placeholder="Ex: Kossi Toko" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="tenant@email.com" required />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800">
          <Button asChild variant="outline" disabled={loading}>
            <Link href={`${dashboardPath}/tenants`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creation...' : 'Creer le locataire'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
