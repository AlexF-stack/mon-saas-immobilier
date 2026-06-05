'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  partyAddressLabel,
  RENTAL_PARTY_IDENTITY_FIELDS,
  RENTAL_PROPERTY_FIELDS,
} from '@/lib/contract-party-fields'

type PartyProfileFormProps = {
  contractId: string
  role: 'owner' | 'tenant'
  canEdit: boolean
  title: string
  description: string
  submittedAt?: string | null
}

type PartyPayload = {
  name: string
  phone: string
  email: string
  birthDate: string
  birthPlace: string
  nationality: string
  profession: string
  idDocumentNumber: string
  currentAddress: string
  completedAt: string | null
  missingFields: string[]
}

type ProfileResponse = {
  owner: PartyPayload
  tenant: PartyPayload
  property: { roomCount: number | string; surfaceSqm: number | string; floor: string }
  submittedAt: string | null
  contractType?: string
}

export function ContractPartyProfileForm({
  contractId,
  role,
  canEdit,
  title,
  description,
  submittedAt,
}: PartyProfileFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [party, setParty] = useState<PartyPayload | null>(null)
  const [property, setProperty] = useState({ roomCount: '', surfaceSqm: '', floor: '' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/contracts/${contractId}/party-profile`, { credentials: 'include' })
        const data = (await res.json().catch(() => ({}))) as ProfileResponse
        if (!res.ok || cancelled) return
        setParty(role === 'owner' ? data.owner : data.tenant)
        setProperty({
          roomCount: String(data.property.roomCount ?? ''),
          surfaceSqm: String(data.property.surfaceSqm ?? ''),
          floor: data.property.floor ?? '',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [contractId, role])

  if (!canEdit) return null
  if (role === 'tenant' && !submittedAt) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Complétez vos informations après que le bailleur ait soumis le contrat.
      </div>
    )
  }

  if (loading || !party) {
    return <p className="text-xs text-muted-foreground">Chargement du formulaire (Article 1 du bail)...</p>
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!party) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/contracts/${contractId}/party-profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          party: {
            name: party.name,
            phone: party.phone,
            birthDate: party.birthDate,
            birthPlace: party.birthPlace,
            nationality: party.nationality,
            profession: party.profession,
            idDocumentNumber: party.idDocumentNumber,
            currentAddress: party.currentAddress,
          },
          property:
            role === 'owner'
              ? {
                  roomCount: property.roomCount ? Number(property.roomCount) : null,
                  surfaceSqm: property.surfaceSqm ? Number(property.surfaceSqm) : null,
                  floor: property.floor,
                }
              : undefined,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof result?.error === 'string' ? result.error : 'Enregistrement impossible.')
        return
      }
      setMessage(typeof result?.message === 'string' ? result.message : 'Informations enregistrées.')
      router.refresh()
    } catch {
      setError('Erreur réseau.')
    } finally {
      setSaving(false)
    }
  }

  const isComplete = Boolean(party.completedAt)
  const addressLabel = partyAddressLabel(role)
  const who = role === 'owner' ? 'bailleur' : 'locataire'

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div>
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Mêmes champs que le contrat de bail d&apos;habitation (Article 1
          {role === 'owner' ? ' et Article 2 — bien loué' : ''}) et la quittance.
        </p>
        {isComplete ? (
          <p className="mt-1 text-xs text-emerald-600">Profil complet — requis pour la suite.</p>
        ) : (
          <p className="mt-1 text-xs text-amber-700">
            Obligatoire avant {role === 'owner' ? 'la soumission' : 'la signature'}.
            {party.missingFields.length > 0 ? (
              <span className="block mt-1">Manquant : {party.missingFields.join(', ')}</span>
            ) : null}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.name.label}</Label>
          <Input
            value={party.name}
            onChange={(e) => setParty((p) => (p ? { ...p, name: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.birthDate.label}</Label>
          <Input
            type="date"
            value={party.birthDate}
            onChange={(e) => setParty((p) => (p ? { ...p, birthDate: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.birthPlace.label}</Label>
          <Input
            value={party.birthPlace}
            onChange={(e) => setParty((p) => (p ? { ...p, birthPlace: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.nationality.label}</Label>
          <Input
            value={party.nationality}
            onChange={(e) => setParty((p) => (p ? { ...p, nationality: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.profession.label}</Label>
          <Input
            value={party.profession}
            onChange={(e) => setParty((p) => (p ? { ...p, profession: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.idDocumentNumber.label}</Label>
          <Input
            value={party.idDocumentNumber}
            onChange={(e) => setParty((p) => (p ? { ...p, idDocumentNumber: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{addressLabel}</Label>
          <Input
            value={party.currentAddress}
            onChange={(e) => setParty((p) => (p ? { ...p, currentAddress: e.target.value } : p))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.phone.label}</Label>
          <Input
            value={party.phone}
            onChange={(e) => setParty((p) => (p ? { ...p, phone: e.target.value } : p))}
            placeholder="+229..."
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{RENTAL_PARTY_IDENTITY_FIELDS.email.label}</Label>
          <Input value={party.email} readOnly disabled className="bg-muted/50" />
        </div>
      </div>

      {role === 'owner' ? (
        <div className="grid gap-3 sm:grid-cols-3 border-t border-border pt-3">
          <p className="sm:col-span-3 text-xs font-medium text-primary">
            Article 2 — Bien loué ({who})
          </p>
          <div className="space-y-1">
            <Label>{RENTAL_PROPERTY_FIELDS.roomCount.label}</Label>
            <Input
              type="number"
              min={1}
              value={property.roomCount}
              onChange={(e) => setProperty((p) => ({ ...p, roomCount: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>{RENTAL_PROPERTY_FIELDS.surfaceSqm.label}</Label>
            <Input
              type="number"
              min={1}
              value={property.surfaceSqm}
              onChange={(e) => setProperty((p) => ({ ...p, surfaceSqm: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>{RENTAL_PROPERTY_FIELDS.floor.label}</Label>
            <Input
              value={property.floor}
              onChange={(e) => setProperty((p) => ({ ...p, floor: e.target.value }))}
              placeholder="RDC, 1er, etc."
              required
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Enregistrement...' : 'Enregistrer les informations'}
      </Button>
    </form>
  )
}
