'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type TransactionSummary = {
  id: string
  status: string
  escrowAmount: number
  totalAmount: number
  buyerId: string
  sellerId: string | null
  legalVerification?: {
    documentUrl: string | null
    buyerConfirmedAt: string | null
    sellerUploadedAt: string | null
    adminVerifiedAt: string | null
  } | null
}

type PurchaseTransactionPanelProps = {
  propertyId: string
  propertyStatus: string
  price: number
  managerId: string | null
  user: { id: string; role: string } | null
  transaction: TransactionSummary | null
  recommendedEscrowAmount: number
}

const STATUS_LABELS: Record<string, string> = {
  INITIATED: 'Initie',
  FUNDS_ESCROWED: 'Fonds sequestrés',
  LEGAL_VERIFIED: 'Documents verifies',
  COMPLETED: 'Terminee',
  DISPUTED: 'En litige',
  CANCELLED: 'Annulee',
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

export function PurchaseTransactionPanel({
  propertyId,
  propertyStatus,
  price,
  managerId,
  user,
  transaction,
  recommendedEscrowAmount,
}: PurchaseTransactionPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [documentUrl, setDocumentUrl] = useState(transaction?.legalVerification?.documentUrl ?? '')
  const [disputeReason, setDisputeReason] = useState('')

  const isAuthenticated = Boolean(user)
  const isBuyer = user?.role === 'TENANT'
  const isSeller = user?.role === 'MANAGER' && managerId && user?.id === managerId
  const isAdmin = user?.role === 'ADMIN'

  const legal = transaction?.legalVerification ?? null

  useEffect(() => {
    setDocumentUrl(transaction?.legalVerification?.documentUrl ?? '')
  }, [transaction?.legalVerification?.documentUrl])

  async function handleRequest(endpoint: string, payload?: Record<string, unknown>) {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: payload ? JSON.stringify(payload) : undefined,
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.error?.[0]?.message ?? result.error ?? 'Action impossible.')
        return
      }
      setSuccess(result.message ?? 'Action enregistree.')
      router.refresh()
    } catch {
      setError('Erreur reseau. Verifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  function handleInitiate() {
    return handleRequest('/api/transactions/initiate', { propertyId })
  }

  function handleWorkflow(action: string, extra?: Record<string, unknown>) {
    if (!transaction) return
    return handleRequest(`/api/transactions/${transaction.id}/workflow`, { action, ...extra })
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Achat securise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-secondary">
          <p>Connectez-vous pour initier un achat avec sequestre securise.</p>
          <Button asChild className="w-full">
            <a href="/login">Se connecter</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!isBuyer && !isSeller && !isAdmin) {
    return null
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Achat securise</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
          <span>Prix total: {formatMoney(price)}</span>
          <span>Sequestre: {formatMoney(recommendedEscrowAmount)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-secondary">
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

        {!transaction && propertyStatus === 'AVAILABLE' && isBuyer ? (
          <Button onClick={handleInitiate} disabled={loading} className="w-full">
            {loading ? 'Traitement...' : 'Initier un achat securise'}
          </Button>
        ) : null}

        {!transaction && propertyStatus !== 'AVAILABLE' ? (
          <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            Transaction en cours sur ce bien. Revenez plus tard.
          </p>
        ) : null}

        {transaction ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Statut</Badge>
              <Badge variant={transaction.status === 'COMPLETED' ? 'success' : 'secondary'}>
                {STATUS_LABELS[transaction.status] ?? transaction.status}
              </Badge>
            </div>

            {isSeller && transaction.status === 'FUNDS_ESCROWED' ? (
              <div className="space-y-2">
                <Label htmlFor="documentUrl">Lien de l acte (PDF)</Label>
                <Input
                  id="documentUrl"
                  value={documentUrl}
                  onChange={(event) => setDocumentUrl(event.target.value)}
                  placeholder="https://.../acte.pdf"
                />
                <Button
                  onClick={() => handleWorkflow('SELLER_UPLOAD', { documentUrl })}
                  disabled={loading || !documentUrl.trim()}
                  className="w-full"
                >
                  {loading ? 'Envoi...' : 'Soumettre le document'}
                </Button>
              </div>
            ) : null}

            {isBuyer && transaction.status !== 'COMPLETED' ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleWorkflow('BUYER_CONFIRM')}
                  disabled={loading || !legal?.documentUrl || Boolean(legal?.buyerConfirmedAt)}
                  className="w-full"
                >
                  {legal?.buyerConfirmedAt ? 'Documents confirmes' : 'Confirmer reception des documents'}
                </Button>

                <Label htmlFor="disputeReason">Signaler un litige</Label>
                <Textarea
                  id="disputeReason"
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  placeholder="Expliquez la raison du litige (min 10 caracteres)."
                />
                <Button
                  variant="outline"
                  onClick={() => handleWorkflow('DISPUTE', { reason: disputeReason })}
                  disabled={loading || disputeReason.trim().length < 10}
                  className="w-full"
                >
                  Ouvrir un litige
                </Button>
              </div>
            ) : null}

            {isAdmin ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleWorkflow('ESCROW_PAID')}
                  disabled={loading || transaction.status !== 'INITIATED'}
                  className="w-full"
                >
                  Confirmer le sequestre
                </Button>
                <Button
                  onClick={() => handleWorkflow('ADMIN_VERIFY')}
                  disabled={
                    loading ||
                    transaction.status !== 'FUNDS_ESCROWED' ||
                    !legal?.buyerConfirmedAt ||
                    !legal?.sellerUploadedAt
                  }
                  className="w-full"
                >
                  Valider les documents
                </Button>
                <Button
                  onClick={() => handleWorkflow('COMPLETE')}
                  disabled={loading || transaction.status !== 'LEGAL_VERIFIED'}
                  className="w-full"
                >
                  Finaliser la vente
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
