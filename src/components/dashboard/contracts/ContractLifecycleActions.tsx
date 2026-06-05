'use client'

import { useMemo, useState } from 'react'
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
  rentalTermsSnapshot?: string | null
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

function translateWorkflowError(message: string): string {
  if (message.includes('Save a contract document first')) {
    return 'Enregistrez d abord le document du contrat (texte ou URL PDF), puis soumettez.'
  }
  if (message.includes('Contract must be submitted before signature')) {
    return 'Soumettez le contrat au locataire avant de signer.'
  }
  if (message.includes('contractText is required')) {
    return 'Le texte du contrat est obligatoire (minimum quelques lignes).'
  }
  if (message.includes('contractFileUrl is required')) {
    return 'L URL du PDF du contrat est obligatoire en mode upload.'
  }
  return message
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
  const [contractText, setContractText] = useState(
    props.contractText?.trim() || props.rentalTermsSnapshot?.trim() || ''
  )
  const [receiptFileUrl, setReceiptFileUrl] = useState(props.receiptFileUrl ?? '')
  const [receiptText, setReceiptText] = useState(props.receiptText ?? '')

  const hasPersistedDocument = useMemo(
    () =>
      Boolean(
        props.fileUrl?.trim() ||
          props.contractText?.trim() ||
          (props.rentalTermsSnapshot?.trim().length ?? 0) >= 20
      ),
    [props.fileUrl, props.contractText, props.rentalTermsSnapshot]
  )

  const hasLocalDocument = useMemo(() => {
    if (source === 'UPLOAD') return contractFileUrl.trim().length > 0
    return contractText.trim().length >= 20
  }, [source, contractFileUrl, contractText])

  const isSubmitted = Boolean(props.submittedAt)
  const canSubmit = props.canManage && !isSubmitted && (hasPersistedDocument || hasLocalDocument)
  const canSignNow = props.canSign && isSubmitted

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
        const raw =
          typeof result?.error === 'string'
            ? result.error
            : Array.isArray(result?.error) && typeof result.error[0]?.message === 'string'
              ? result.error[0].message
              : fallback
        setError(translateWorkflowError(raw))
        return false
      }

      setMessage(
        typeof result?.message === 'string'
          ? translateWorkflowError(result.message) || 'Operation validee.'
          : 'Operation validee.'
      )
      router.refresh()
      return true
    } catch {
      setError('Erreur reseau.')
      return false
    } finally {
      setLoading(false)
    }
  }

  function buildSavePayload() {
    return {
      action: 'SAVE_DOCUMENT' as const,
      documentSource: source,
      contractType,
      contractFileUrl: source === 'UPLOAD' ? contractFileUrl.trim() || undefined : undefined,
      contractText: source === 'DRAFT' ? contractText.trim() || undefined : undefined,
      receiptFileUrl: receiptFileUrl.trim() || undefined,
      receiptText: receiptText.trim() || undefined,
    }
  }

  async function handleSaveDocument() {
    if (source === 'DRAFT' && contractText.trim().length < 20) {
      setError('Le texte du contrat doit contenir au moins 20 caracteres.')
      return
    }
    if (source === 'UPLOAD' && !contractFileUrl.trim()) {
      setError('Indiquez l URL du PDF du contrat.')
      return
    }
    await sendPayload(buildSavePayload())
  }

  async function handleSubmitContract() {
    if (!hasPersistedDocument && hasLocalDocument) {
      const saved = await sendPayload(buildSavePayload())
      if (!saved) return
    }
    await sendPayload({ action: 'SUBMIT' })
  }

  async function handleSignContract() {
    if (!isSubmitted) {
      setError('Soumettez le contrat au locataire avant de signer.')
      return
    }
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
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li className={hasPersistedDocument ? 'text-emerald-700 dark:text-emerald-400' : ''}>
            Enregistrer le document (texte ou PDF)
          </li>
          <li className={isSubmitted ? 'text-emerald-700 dark:text-emerald-400' : ''}>
            Soumettre au locataire / acheteur
          </li>
          <li className={props.ownerSignedAt ? 'text-emerald-700 dark:text-emerald-400' : ''}>
            Signer (proprietaire puis locataire)
          </li>
        </ol>
      ) : null}

      {props.canManage ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-secondary">Preparation du contrat</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`contract-type-${props.contractId}`}>Type</Label>
              <select
                id={`contract-type-${props.contractId}`}
                value={contractType}
                onChange={(event) => setContractType(event.target.value === 'SALE' ? 'SALE' : 'RENTAL')}
                className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-primary outline-none"
                disabled={isSubmitted}
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
                disabled={isSubmitted}
              >
                <option value="DRAFT">Rediger dans l&apos;application</option>
                <option value="UPLOAD">Upload (URL PDF)</option>
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
                disabled={isSubmitted}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor={`contract-text-${props.contractId}`}>Texte du contrat</Label>
              <Textarea
                id={`contract-text-${props.contractId}`}
                value={contractText}
                onChange={(event) => setContractText(event.target.value)}
                rows={6}
                placeholder="Clauses du contrat (pre-rempli avec vos conditions par defaut)..."
                disabled={isSubmitted}
              />
              <p className="text-xs text-muted-foreground">Minimum 20 caracteres.</p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`receipt-url-${props.contractId}`}>URL quittance (optionnel)</Label>
            <Input
              id={`receipt-url-${props.contractId}`}
              value={receiptFileUrl}
              onChange={(event) => setReceiptFileUrl(event.target.value)}
              placeholder="https://..."
              disabled={isSubmitted}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || isSubmitted}
              onClick={() => void handleSaveDocument()}
            >
              {loading ? 'Traitement...' : '1. Enregistrer le contrat'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading || !canSubmit}
              onClick={() => void handleSubmitContract()}
            >
              {loading ? 'Traitement...' : '2. Soumettre au locataire'}
            </Button>
          </div>
          {!canSubmit && !isSubmitted ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Renseignez le texte du contrat (ou l&apos;URL PDF), puis enregistrez avant de soumettre.
            </p>
          ) : null}
        </div>
      ) : null}

      {canSignNow ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void handleSignContract()}
        >
          {loading ? 'Traitement...' : '3. Signer le contrat'}
        </Button>
      ) : props.canSign && !isSubmitted ? (
        <p className="text-xs text-muted-foreground">
          La signature sera disponible apres soumission du contrat par le proprietaire.
        </p>
      ) : null}

      {message ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}
