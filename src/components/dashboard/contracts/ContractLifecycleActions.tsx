'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ContractLifecycleActionsProps = {
  contractId: string
  contractType: string
  workflowState: string
  documentSource: string | null
  fileUrl: string | null
  contractText: string | null
  receiptFileUrl: string | null
  receiptText: string | null
  submittedAt: string | null
  ownerSignedAt: string | null
  tenantSignedAt: string | null
  canManage: boolean
  canSign: boolean
}

function stateLabel(state: string): string {
  if (state === 'DRAFT') return 'Brouillon'
  if (state === 'SUBMITTED') return 'Soumis'
  if (state === 'SIGNED_BOTH') return 'Signe par les deux'
  if (state === 'PAYMENT_INITIATED') return 'Paiement initie'
  if (state === 'ACTIVE') return 'Actif'
  return state
}

export function ContractLifecycleActions(props: ContractLifecycleActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [source, setSource] = useState<'UPLOAD' | 'DRAFT'>(
    props.documentSource === 'UPLOAD' ? 'UPLOAD' : 'DRAFT'
  )
  const [contractType, setContractType] = useState<'RENTAL' | 'SALE'>(
    props.contractType === 'SALE' ? 'SALE' : 'RENTAL'
  )
  const [contractFileUrl, setContractFileUrl] = useState(props.fileUrl ?? '')
  const [contractText, setContractText] = useState(props.contractText ?? '')
  const [receiptFileUrl, setReceiptFileUrl] = useState(props.receiptFileUrl ?? '')
  const [receiptText, setReceiptText] = useState(props.receiptText ?? '')

  async function sendPayload(payload: Record<string, unknown>) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/contracts/${props.contractId}/workflow`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const fallback = 'Operation impossible.'
        const details =
          typeof result?.error === 'string'
            ? result.error
            : Array.isArray(result?.error) && typeof result.error[0]?.message === 'string'
              ? result.error[0].message
              : fallback
        setError(details)
        return
      }

      setMessage(typeof result?.message === 'string' ? result.message : 'Operation validee.')
      router.refresh()
    } catch {
      setError('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDocument() {
    await sendPayload({
      action: 'SAVE_DOCUMENT',
      documentSource: source,
      contractType,
      contractFileUrl: source === 'UPLOAD' ? contractFileUrl.trim() || undefined : undefined,
      contractText: source === 'DRAFT' ? contractText.trim() || undefined : undefined,
      receiptFileUrl: receiptFileUrl.trim() || undefined,
      receiptText: receiptText.trim() || undefined,
    })
  }

  async function handleSubmitContract() {
    await sendPayload({ action: 'SUBMIT' })
  }

  async function handleSignContract() {
    await sendPayload({ action: 'SIGN' })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface/70 p-3 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{props.contractType === 'SALE' ? 'Vente' : 'Location'}</Badge>
        <Badge variant="secondary">{stateLabel(props.workflowState)}</Badge>
        {props.submittedAt ? <Badge variant="outline">Soumis</Badge> : null}
        {props.ownerSignedAt ? <Badge variant="outline">Signe proprietaire</Badge> : null}
        {props.tenantSignedAt ? <Badge variant="outline">Signe locataire/acheteur</Badge> : null}
      </div>

      {props.canManage ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-secondary">Preparation du contrat professionnel</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`contract-type-${props.contractId}`}>Type</Label>
              <select
                id={`contract-type-${props.contractId}`}
                value={contractType}
                onChange={(event) => setContractType(event.target.value === 'SALE' ? 'SALE' : 'RENTAL')}
                className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-primary outline-none"
              >
                <option value="RENTAL">Location</option>
                <option value="SALE">Vente</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`contract-source-${props.contractId}`}>Mode document</Label>
              <select
                id={`contract-source-${props.contractId}`}
                value={source}
                onChange={(event) => setSource(event.target.value === 'UPLOAD' ? 'UPLOAD' : 'DRAFT')}
                className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-primary outline-none"
              >
                <option value="UPLOAD">Upload (URL)</option>
                <option value="DRAFT">Rediger dans l&apos;application</option>
              </select>
            </div>
          </div>

          {source === 'UPLOAD' ? (
            <div className="space-y-1">
              <Label htmlFor={`contract-file-url-${props.contractId}`}>URL contrat (PDF)</Label>
              <Input
                id={`contract-file-url-${props.contractId}`}
                value={contractFileUrl}
                onChange={(event) => setContractFileUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor={`contract-text-${props.contractId}`}>Texte du contrat</Label>
              <Textarea
                id={`contract-text-${props.contractId}`}
                value={contractText}
                onChange={(event) => setContractText(event.target.value)}
                rows={5}
                placeholder="Clauses professionnelles du contrat..."
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`receipt-url-${props.contractId}`}>URL quittance pro (optionnel)</Label>
            <Input
              id={`receipt-url-${props.contractId}`}
              value={receiptFileUrl}
              onChange={(event) => setReceiptFileUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`receipt-text-${props.contractId}`}>Texte quittance (optionnel)</Label>
            <Textarea
              id={`receipt-text-${props.contractId}`}
              value={receiptText}
              onChange={(event) => setReceiptText(event.target.value)}
              rows={3}
              placeholder="Mentions legales et conditions de quittance..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleSaveDocument}>
              {loading ? 'Traitement...' : 'Enregistrer le contrat'}
            </Button>
            <Button type="button" size="sm" disabled={loading} onClick={handleSubmitContract}>
              {loading ? 'Traitement...' : 'Soumettre au locataire/acheteur'}
            </Button>
          </div>
        </div>
      ) : null}

      {props.canSign ? (
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleSignContract}>
          {loading ? 'Traitement...' : 'Signer le contrat'}
        </Button>
      ) : null}

      {message ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}
