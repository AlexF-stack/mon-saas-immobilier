'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type InstallmentOption = {
  id: string
  sequence: number
  dueDate: string
  status: string
  totalDue: number
  pendingPayment?: {
    id: string
    amount: number
    transactionId: string | null
    status: string
  } | null
  label?: string
}

type FirstPaymentRule = {
  label: string
  advanceMonths: number
  depositAmount: number
  advanceRent: number
  totalDue: number
}

const PAYMENT_ERROR_FR: Record<string, string> = {
  'A payment is already pending for this installment.':
    'Un paiement est deja en attente pour cette echeance. Utilisez « Payer maintenant » pour afficher les instructions.',
  'Installment already paid.': 'Cette echeance est deja payee.',
  'Contract is not active for payment.': 'Ce contrat n est pas actif pour un paiement.',
  'Contract must be submitted and signed by both parties before payment.':
    'Le contrat doit etre soumis et signe par les deux parties avant le paiement.',
  'Phone number is required for direct mobile money payments.':
    'Le numero de telephone est obligatoire pour Mobile Money.',
}

type PaymentCollection = {
  mode: 'DIRECT' | 'PLATFORM'
  momoNumber: string | null
  momoProvider: string | null
  cardLink: string | null
  instructions: string | null
}

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return PAYMENT_ERROR_FR[errorPayload] ?? errorPayload
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
  const [loadingInstallments, setLoadingInstallments] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [provider, setProvider] = useState('MTN')
  const [contractId, setContractId] = useState(contractIdParam || '')
  const [contractType, setContractType] = useState<'RENTAL' | 'SALE' | null>(null)
  const [installments, setInstallments] = useState<InstallmentOption[]>([])
  const [installmentId, setInstallmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentCollection, setPaymentCollection] = useState<PaymentCollection | null>(null)
  const [firstPaymentRule, setFirstPaymentRule] = useState<FirstPaymentRule | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadInstallments() {
        if (!contractId.trim()) {
          setContractType(null)
          setInstallments([])
          setInstallmentId('')
          setPaymentCollection(null)
          return
        }

      setLoadingInstallments(true)
      try {
        const res = await fetch(`/api/contracts/${contractId.trim()}/installments`, {
          credentials: 'include',
        })
        if (!res.ok) {
          if (!cancelled) {
            setContractType(null)
            setInstallments([])
            setInstallmentId('')
            setPaymentCollection(null)
          }
          return
        }

        const payload = await res.json().catch(() => ({}))
        if (cancelled) return

        const nextType = payload?.contractType === 'SALE' ? 'SALE' : 'RENTAL'
        const nextInstallments = Array.isArray(payload?.installments)
          ? (payload.installments as InstallmentOption[])
          : []

        setContractType(nextType)
        setInstallments(nextInstallments)
        setPaymentCollection(payload?.paymentCollection ?? null)
        setFirstPaymentRule(payload?.firstPaymentRule ?? null)
        if (nextType === 'RENTAL' && nextInstallments.length > 0) {
          setInstallmentId(nextInstallments[0].id)
          setAmount(String(Math.round(nextInstallments[0].totalDue)))
        } else if (nextType === 'RENTAL') {
          setInstallmentId('')
          setAmount('')
        }
      } catch {
        if (!cancelled) {
          setContractType(null)
          setInstallments([])
          setInstallmentId('')
          setPaymentCollection(null)
        }
      } finally {
        if (!cancelled) setLoadingInstallments(false)
      }
    }

    void loadInstallments()

    return () => {
      cancelled = true
    }
  }, [contractId])

  useEffect(() => {
    if (contractType !== 'RENTAL') return
    const selected = installments.find((item) => item.id === installmentId)
    if (selected) {
      setAmount(String(Math.round(selected.totalDue)))
      if (selected.pendingPayment) {
        setSuccess(
          `Paiement en attente (${selected.pendingPayment.id}). Effectuez le transfert Mobile Money sur le compte du bailleur, puis attendez la confirmation.`
        )
        setError('')
      } else {
        setSuccess('')
      }
    }
  }, [contractType, installments, installmentId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(event.currentTarget)
    const data = {
      contractId: formData.get('contractId'),
      installmentId: contractType === 'RENTAL' ? formData.get('installmentId') : undefined,
      amount: formData.get('amount'),
      phoneNumber:
        paymentCollection?.mode === 'DIRECT' && provider === 'CARD'
          ? undefined
          : formData.get('phoneNumber'),
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
        const resumed = result.resumed === true
        if (result.paymentCollection) {
          setPaymentCollection(result.paymentCollection as PaymentCollection)
        }
        const baseMessage =
          typeof result.message === 'string' && result.message
            ? result.message
            : replayed || resumed
              ? 'Paiement en attente recupere. Suivez les instructions ci-dessous.'
              : 'Paiement initie avec succes.'
        setSuccess(
          typeof result.paymentId === 'string'
            ? `${baseMessage} Reference : ${result.paymentId}`
            : baseMessage
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
            <Input
              id="contractId"
              name="contractId"
              value={contractId}
              onChange={(event) => setContractId(event.target.value)}
              required
            />
          </div>

          {contractType === 'RENTAL' && firstPaymentRule ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-medium">Premier paiement : {firstPaymentRule.label}</p>
              <p className="mt-1 text-xs">
                Caution {Math.round(firstPaymentRule.depositAmount).toLocaleString('fr-FR')} FCFA +{' '}
                {firstPaymentRule.advanceMonths} mois d&apos;avance (
                {Math.round(firstPaymentRule.advanceRent).toLocaleString('fr-FR')} FCFA) ={' '}
                <strong>{Math.round(firstPaymentRule.totalDue).toLocaleString('fr-FR')} FCFA</strong>
              </p>
            </div>
          ) : null}

          {contractType === 'RENTAL' ? (
            <div className="space-y-2">
              <Label htmlFor="installmentId">Echeance a payer</Label>
              <Select
                name="installmentId"
                value={installmentId}
                onValueChange={setInstallmentId}
                disabled={loadingInstallments}
              >
                <SelectTrigger id="installmentId">
                  <SelectValue placeholder={loadingInstallments ? 'Chargement...' : 'Choisir une echeance'} />
                </SelectTrigger>
                <SelectContent>
                  {installments.length > 0 ? (
                    installments.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label ?? `#${item.sequence}`} — {new Date(item.dueDate).toLocaleDateString('fr-FR')} —{' '}
                        {Math.round(item.totalDue).toLocaleString('fr-FR')} FCFA ({item.status})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>
                      Aucune echeance ouverte
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="amount">Montant (FCFA)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              readOnly={contractType === 'RENTAL'}
              required
            />
          </div>

          {paymentCollection?.mode === 'DIRECT' ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4 text-sm">
              <p className="font-medium text-primary">Paiement direct proprietaire</p>
              {paymentCollection.momoNumber ? (
                <p className="text-secondary">
                  Mobile Money: {paymentCollection.momoProvider || 'MOMO'} - {paymentCollection.momoNumber}
                </p>
              ) : null}
              {paymentCollection.cardLink ? (
                <p className="text-secondary">Lien carte configure par le proprietaire disponible ci-dessous.</p>
              ) : null}
              {paymentCollection.instructions ? (
                <p className="text-secondary">{paymentCollection.instructions}</p>
              ) : null}
            </div>
          ) : null}

          {paymentCollection?.mode !== 'DIRECT' || provider !== 'CARD' ? (
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Numero de telephone</Label>
              <Input id="phoneNumber" name="phoneNumber" placeholder="22997000000" required={paymentCollection?.mode !== 'DIRECT' || provider !== 'CARD'} />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="provider">Moyen de paiement</Label>
            <Select name="provider" value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                <SelectItem value="MOOV">Moov Money</SelectItem>
                {paymentCollection?.cardLink ? <SelectItem value="CARD">Carte bancaire</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>

          {paymentCollection?.mode === 'DIRECT' && provider === 'CARD' && paymentCollection.cardLink ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Ouvrez le lien du proprietaire pour regler par carte: <a className="underline" href={paymentCollection.cardLink} target="_blank" rel="noreferrer">{paymentCollection.cardLink}</a>
            </div>
          ) : null}
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
