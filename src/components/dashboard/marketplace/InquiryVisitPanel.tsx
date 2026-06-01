'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type InquiryDetail = {
  id: string
  lifecycleStage: string
  visitStatus: string
  scheduledVisitAt: string | null
  visitNotes: string | null
  preferredVisitDate: string | null
  requesterName: string
  property: { title: string }
}

const STAGE_OPTIONS = [
  { value: 'LEAD', label: 'Prospect' },
  { value: 'VISIT_SCHEDULED', label: 'Visite programmee' },
  { value: 'QUALIFIED', label: 'Qualifie' },
  { value: 'APPROVED', label: 'Approuve' },
  { value: 'CONTRACT_DRAFT', label: 'Brouillon contrat' },
  { value: 'CONTRACT_SENT', label: 'Contrat envoye' },
  { value: 'CLOSED', label: 'Cloture' },
]

const VISIT_STATUS_OPTIONS = [
  { value: 'REQUESTED', label: 'Demandee' },
  { value: 'SCHEDULED', label: 'Programmee' },
  { value: 'CONFIRMED', label: 'Confirmee' },
  { value: 'COMPLETED', label: 'Terminee' },
  { value: 'CANCELLED', label: 'Annulee' },
]

type InquiryVisitPanelProps = {
  inquiryId: string
  canManage: boolean
  onUpdated?: () => void
}

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function InquiryVisitPanel({ inquiryId, canManage, onUpdated }: InquiryVisitPanelProps) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lifecycleStage, setLifecycleStage] = useState('LEAD')
  const [visitStatus, setVisitStatus] = useState('REQUESTED')
  const [scheduledVisitAt, setScheduledVisitAt] = useState('')
  const [visitNotes, setVisitNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/marketplace/inquiries/${inquiryId}`, {
          credentials: 'include',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        const row = payload as InquiryDetail
        setDetail(row)
        setLifecycleStage(row.lifecycleStage)
        setVisitStatus(row.visitStatus)
        setScheduledVisitAt(toDateTimeLocalValue(row.scheduledVisitAt))
        setVisitNotes(row.visitNotes ?? '')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [inquiryId])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/marketplace/inquiries/${inquiryId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lifecycleStage,
          visitStatus,
          scheduledVisitAt: scheduledVisitAt ? new Date(scheduledVisitAt).toISOString() : null,
          visitNotes: visitNotes.trim() || null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Mise a jour impossible.')
        return
      }
      if (payload?.inquiry) {
        setDetail(payload.inquiry as InquiryDetail)
      }
      onUpdated?.()
    } catch {
      setError('Erreur reseau.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-secondary p-4">Chargement du suivi visite...</p>
  }

  if (!detail) {
    return null
  }

  return (
    <section className="border-b border-border bg-surface/30 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-primary">Visite et pipeline</h4>
        <p className="text-xs text-muted-foreground">
          {detail.requesterName} · {detail.property.title}
          {detail.preferredVisitDate
            ? ` · Souhait : ${new Date(detail.preferredVisitDate).toLocaleDateString('fr-FR')}`
            : ''}
        </p>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Etape pipeline</Label>
          <Select
            value={lifecycleStage}
            onValueChange={setLifecycleStage}
            disabled={!canManage}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Statut visite</Label>
          <Select value={visitStatus} onValueChange={setVisitStatus} disabled={!canManage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledVisitAt">Date et heure de visite</Label>
        <Input
          id="scheduledVisitAt"
          type="datetime-local"
          value={scheduledVisitAt}
          onChange={(e) => setScheduledVisitAt(e.target.value)}
          disabled={!canManage}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visitNotes">Notes visite</Label>
        <Textarea
          id="visitNotes"
          value={visitNotes}
          onChange={(e) => setVisitNotes(e.target.value)}
          placeholder="Instructions d acces, contact sur place..."
          disabled={!canManage}
          className="min-h-[72px]"
        />
      </div>

      {canManage ? (
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Enregistrement...' : 'Enregistrer visite et pipeline'}
        </Button>
      ) : null}
    </section>
  )
}
