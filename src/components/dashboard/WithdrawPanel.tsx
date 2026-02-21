'use client'

import { useState } from 'react'
import { BanknoteArrowDown, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type WithdrawalStatus = 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED'

export interface WithdrawItemView {
  withdrawalId: string
  amount: number
  method: string
  accountLabel: string
  accountNumberMasked: string
  note?: string
  status: WithdrawalStatus
  requestedAt: string
  updatedAt: string
  actorEmail?: string | null
  actorRole?: string | null
}

interface WithdrawPanelProps {
  availableBalance: number
  reservedTotal: number
  paidTotal: number
  recentWithdrawals: WithdrawItemView[]
  reviewQueue?: WithdrawItemView[]
  isAdmin?: boolean
}

type DraftWithdrawal = {
  amount: number
  method: 'MOMO' | 'BANK' | 'CASHOUT'
  accountLabel: string
  accountNumber: string
  note?: string
}

function toErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (Array.isArray(payload) && typeof payload[0]?.message === 'string') {
    return String(payload[0].message)
  }

  if (status === 401) return 'Session expiree. Reconnectez-vous.'
  if (status === 403) return 'Action reservee a un administrateur ou un manager.'
  if (status === 409) return 'Action refusee par les regles metier.'
  return 'Impossible de traiter la demande de retrait.'
}

function statusBadgeClass(status: WithdrawalStatus): string {
  if (status === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'APPROVED') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'REJECTED') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
}

function statusLabel(status: WithdrawalStatus): string {
  if (status === 'REQUESTED') return 'Demande'
  if (status === 'APPROVED') return 'Approuve'
  if (status === 'PAID') return 'Paye'
  return 'Rejete'
}

function methodLabel(method: string): string {
  if (method === 'MOMO') return 'Mobile Money'
  if (method === 'BANK') return 'Banque'
  if (method === 'CASHOUT') return 'Guichet'
  return method
}

export function WithdrawPanel({
  availableBalance,
  reservedTotal,
  paidTotal,
  recentWithdrawals,
  reviewQueue = [],
  isAdmin = false,
}: WithdrawPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null)
  const [method, setMethod] = useState<'MOMO' | 'BANK' | 'CASHOUT'>('MOMO')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<DraftWithdrawal | null>(null)

  async function submitDraftWithdrawal(payload: DraftWithdrawal) {
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const response = await fetch('/api/payments/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(toErrorMessage(response.status, result.error))
        return
      }

      setSuccess('Demande de retrait enregistree avec succes (statut REQUESTED).')
      setDraft(null)
      setMethod('MOMO')
      router.refresh()
    } catch {
      setError('Erreur reseau lors du retrait.')
    } finally {
      setLoading(false)
    }
  }

  function handlePrepareSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccess('')
    setError('')

    const formData = new FormData(event.currentTarget)
    const payload: DraftWithdrawal = {
      amount: Number(formData.get('amount') ?? 0),
      method,
      accountLabel: String(formData.get('accountLabel') ?? '').trim(),
      accountNumber: String(formData.get('accountNumber') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim() || undefined,
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      setError('Montant invalide.')
      return
    }

    if (payload.amount > availableBalance) {
      setError('Montant superieur au solde disponible.')
      return
    }

    setDraft(payload)
  }

  async function handleReviewStatus(withdrawalId: string, nextStatus: 'APPROVED' | 'PAID' | 'REJECTED') {
    setReviewLoadingId(`${withdrawalId}:${nextStatus}`)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/payments/withdraw/${withdrawalId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(toErrorMessage(response.status, result.error))
        return
      }

      setSuccess(`Retrait ${nextStatus.toLowerCase()} avec succes.`)
      router.refresh()
    } catch {
      setError('Erreur reseau lors de la mise a jour du statut.')
    } finally {
      setReviewLoadingId(null)
    }
  }

  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
          <BanknoteArrowDown className="h-4 w-4" />
          Retrait des fonds
        </CardTitle>
        <CardDescription>
          Disponible: {availableBalance.toLocaleString('fr-FR')} FCFA - Reserve:{' '}
          {reservedTotal.toLocaleString('fr-FR')} FCFA - Paye: {paidTotal.toLocaleString('fr-FR')} FCFA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <form className="grid grid-cols-1 gap-4 lg:grid-cols-2" onSubmit={handlePrepareSubmit}>
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Montant (FCFA)</Label>
            <Input
              id="withdraw-amount"
              name="amount"
              type="number"
              min={1}
              max={Math.max(1, Math.floor(availableBalance))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdraw-method">Methode</Label>
            <Select value={method} onValueChange={(value: 'MOMO' | 'BANK' | 'CASHOUT') => setMethod(value)}>
              <SelectTrigger id="withdraw-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOMO">Mobile Money</SelectItem>
                <SelectItem value="BANK">Virement bancaire</SelectItem>
                <SelectItem value="CASHOUT">Retrait guichet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdraw-account-label">Compte / titulaire</Label>
            <Input id="withdraw-account-label" name="accountLabel" placeholder="Nom du compte" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdraw-account-number">Numero de compte</Label>
            <Input id="withdraw-account-number" name="accountNumber" placeholder="22997000000 / IBAN" required />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="withdraw-note">Note (optionnel)</Label>
            <Textarea id="withdraw-note" name="note" placeholder="Details du retrait..." rows={3} />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={loading || availableBalance <= 0} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                'Demander un retrait'
              )}
            </Button>
          </div>
        </form>

        {draft ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Confirmer le retrait</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Verifie les informations avant validation.
              </p>
              <div className="mt-4 space-y-1 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Montant:</span>{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {draft.amount.toLocaleString('fr-FR')} FCFA
                  </span>
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Methode:</span>{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">{methodLabel(draft.method)}</span>
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Compte:</span>{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">{draft.accountLabel}</span>
                </p>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={loading}>
                  Annuler
                </Button>
                <Button type="button" onClick={() => submitDraftWithdrawal(draft)} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Historique retraits</p>
          {recentWithdrawals.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Aucun retrait enregistre.</p>
          ) : (
            <div className="space-y-2">
              {recentWithdrawals.map((item) => (
                <div
                  key={item.withdrawalId}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {item.accountLabel} - {item.accountNumberMasked}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                      <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {item.amount.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {methodLabel(item.method)} - Demande le {new Date(item.requestedAt).toLocaleDateString('fr-FR')} -
                    Mise a jour le {new Date(item.updatedAt).toLocaleDateString('fr-FR')}
                    {item.note ? ` - ${item.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Validation admin</p>
            {reviewQueue.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucun retrait en attente de validation.</p>
            ) : (
              <div className="space-y-2">
                {reviewQueue.map((item) => (
                  <div
                    key={`review-${item.withdrawalId}`}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.actorEmail || 'Manager'} - {item.accountLabel} ({item.accountNumberMasked})
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {methodLabel(item.method)} - {item.amount.toLocaleString('fr-FR')} FCFA -{' '}
                          {statusLabel(item.status)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status === 'REQUESTED' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewLoadingId !== null}
                              onClick={() => handleReviewStatus(item.withdrawalId, 'APPROVED')}
                            >
                              {reviewLoadingId === `${item.withdrawalId}:APPROVED` ? '...' : 'Approuver'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewLoadingId !== null}
                              onClick={() => handleReviewStatus(item.withdrawalId, 'REJECTED')}
                            >
                              {reviewLoadingId === `${item.withdrawalId}:REJECTED` ? '...' : 'Rejeter'}
                            </Button>
                          </>
                        ) : null}
                        {item.status === 'APPROVED' ? (
                          <>
                            <Button
                              size="sm"
                              disabled={reviewLoadingId !== null}
                              onClick={() => handleReviewStatus(item.withdrawalId, 'PAID')}
                            >
                              {reviewLoadingId === `${item.withdrawalId}:PAID` ? '...' : 'Marquer paye'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewLoadingId !== null}
                              onClick={() => handleReviewStatus(item.withdrawalId, 'REJECTED')}
                            >
                              {reviewLoadingId === `${item.withdrawalId}:REJECTED` ? '...' : 'Rejeter'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
