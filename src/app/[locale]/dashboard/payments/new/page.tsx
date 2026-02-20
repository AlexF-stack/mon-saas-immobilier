'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return errorPayload
  }

  if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
    return String(errorPayload[0].message)
  }

  if (status === 401) return 'Session expiree. Reconnectez-vous.'
  if (status === 403) return 'Acces refuse pour ce contrat.'
  if (status === 409) return 'Paiement impossible: contrat indisponible ou cle idempotente invalide.'

  return fallback
}

function buildIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function PaymentForm() {
  const searchParams = useSearchParams()
  const contractIdParam = searchParams.get('contractId')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [provider, setProvider] = useState('MTN')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(event.currentTarget)
    const data = {
      contractId: formData.get('contractId'),
      amount: formData.get('amount'),
      phoneNumber: formData.get('phoneNumber'),
      provider,
    }

    try {
      const idempotencyKey = buildIdempotencyKey()
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(data),
      })

      const result = await res.json().catch(() => ({}))

      if (res.ok) {
        const replayed = result.idempotent === true
        setSuccess(
          replayed
            ? 'Cette tentative de paiement a deja ete enregistree. Statut recupere avec succes.'
            : result.message || 'Paiement initie avec succes.'
        )
      } else {
        setError(toErrorMessage(res.status, result.error, 'Erreur lors de la creation du paiement.'))
      }
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
          <CardTitle>Nouveau paiement</CardTitle>
          <CardDescription>Initiez un paiement Mobile Money lie a un bail actif.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contractId">ID contrat</Label>
            <Input id="contractId" name="contractId" defaultValue={contractIdParam || ''} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Montant (FCFA)</Label>
            <Input id="amount" name="amount" type="number" min="1" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Numero de telephone</Label>
            <Input id="phoneNumber" name="phoneNumber" placeholder="22997000000" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Moyen de paiement</Label>
            <Select name="provider" value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                <SelectItem value="MOOV">Moov Money</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-slate-200/70 dark:border-slate-800">
          <Button type="submit" disabled={loading}>
            {loading ? 'Traitement...' : 'Payer maintenant'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function NewPaymentPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paiement de loyer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Lancez un paiement et suivez son statut en temps reel.
        </p>
      </div>
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />}
      >
        <PaymentForm />
      </Suspense>
    </section>
  )
}
