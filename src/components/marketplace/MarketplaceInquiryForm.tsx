'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type MarketplaceInquiryFormProps = {
    propertyId: string
    defaultName?: string
    defaultEmail?: string
}

function toErrorMessage(status: number, payload: unknown) {
    if (typeof payload === 'string' && payload.trim()) return payload
    if (Array.isArray(payload) && typeof payload[0]?.message === 'string') return payload[0].message
    if (status === 404) return 'Annonce introuvable ou non disponible.'
    if (status === 403) return 'Action refusee.'
    if (status === 429) return 'Trop de demandes. Merci de reessayer plus tard.'
    return 'Impossible d envoyer la demande pour le moment.'
}

export function MarketplaceInquiryForm({
    propertyId,
    defaultName,
    defaultEmail,
}: MarketplaceInquiryFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        const formData = new FormData(event.currentTarget)
        const requesterName = String(formData.get('requesterName') ?? '').trim()
        const requesterEmail = String(formData.get('requesterEmail') ?? '').trim()
        const requesterPhone = String(formData.get('requesterPhone') ?? '').trim()
        const message = String(formData.get('message') ?? '').trim()
        const website = String(formData.get('website') ?? '').trim()
        const preferredVisitDateRaw = String(formData.get('preferredVisitDate') ?? '').trim()
        const payload = {
            propertyId,
            requesterName: requesterName || undefined,
            requesterEmail: requesterEmail || undefined,
            requesterPhone: requesterPhone || undefined,
            preferredVisitDate: preferredVisitDateRaw || undefined,
            message: message || undefined,
            website: website || undefined,
        }

        try {
            const response = await fetch('/api/marketplace/inquiries', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const result = await response.json().catch(() => ({}))
            if (response.ok) {
                setSuccess(result.message ?? 'Demande envoyee avec succes.')
                event.currentTarget.reset()
                return
            }

            setError(toErrorMessage(response.status, result.error))
        } catch {
            setError('Erreur reseau. Verifiez votre connexion.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                className="hidden"
                aria-hidden="true"
            />
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="requesterName">Nom complet</Label>
                    <Input
                        id="requesterName"
                        name="requesterName"
                        defaultValue={defaultName ?? ''}
                        placeholder="Ex: Kossi Toko"
                        minLength={2}
                        maxLength={120}
                        required={!defaultName}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="requesterEmail">Email</Label>
                    <Input
                        id="requesterEmail"
                        name="requesterEmail"
                        type="email"
                        defaultValue={defaultEmail ?? ''}
                        placeholder="email@example.com"
                        maxLength={254}
                        required={!defaultEmail}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="requesterPhone">Telephone (optionnel)</Label>
                    <Input
                        id="requesterPhone"
                        name="requesterPhone"
                        placeholder="+22997000000"
                        pattern="^\+?[0-9\s().-]{8,25}$"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="preferredVisitDate">Date de visite (optionnel)</Label>
                    <Input id="preferredVisitDate" name="preferredVisitDate" type="date" />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                    id="message"
                    name="message"
                    placeholder="Je suis interesse par ce bien et souhaite programmer une visite."
                    minLength={12}
                    maxLength={1500}
                    required
                />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Envoi...' : 'Postuler / Demander visite'}
            </Button>
        </form>
    )
}
