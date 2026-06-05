'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessageFromPayload } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import {
    getBuyerInquiriesDashboardPath,
    getBuyerRegisterPathAfterInquiry,
} from '@/lib/marketplace-paths'

type MarketplaceInquiryFormProps = {
    propertyId: string
    defaultName?: string
    defaultEmail?: string
    locale?: string
}

function toErrorMessage(status: number, payload: unknown) {
    if (status === 404) return 'Annonce introuvable ou non disponible.'
    if (status === 403) return 'Action refusee.'
    if (status === 429) return 'Trop de demandes. Merci de reessayer plus tard.'
    return getErrorMessageFromPayload(
        (typeof payload === 'object' && payload !== null
            ? ((payload as { error?: unknown }).error ?? payload)
            : payload) as never,
        'Impossible d envoyer la demande pour le moment.'
    )
}

export function MarketplaceInquiryForm({
    propertyId,
    defaultName,
    defaultEmail,
    locale,
}: MarketplaceInquiryFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const pendingRef = useRef(false)
    const { show } = useToast()
    const isAuthenticated = Boolean(defaultEmail)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pendingRef.current) return
        pendingRef.current = true
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
                const inquiryId = typeof result?.inquiry?.id === 'string' ? result.inquiry.id : ''
                const requiresAuth = result?.requiresAuth === true

                if (requiresAuth && inquiryId) {
                    const emailForRegister = requesterEmail || defaultEmail || ''
                    const registerHref = getBuyerRegisterPathAfterInquiry(
                        locale,
                        inquiryId,
                        emailForRegister
                    )
                    show({
                        variant: 'success',
                        title: 'Demande enregistree',
                        description: 'Creez votre compte pour acceder a votre espace de discussion.',
                    })
                    router.push(registerHref)
                    return
                }

                if (inquiryId) {
                    const dashboardHref = getBuyerInquiriesDashboardPath(locale, inquiryId)
                    setSuccess(result.message ?? 'Demande envoyee. Redirection vers votre espace...')
                    show({
                        variant: 'success',
                        title: 'Demande envoyee',
                        description: 'Vous pouvez discuter avec le proprietaire dans votre espace.',
                    })
                    router.push(dashboardHref)
                    return
                }

                setSuccess(result.message ?? 'Demande envoyee avec succes.')
                event.currentTarget.reset()
                return
            }

            setError(toErrorMessage(response.status, result.error))
            show({
                variant: response.status >= 500 ? 'error' : 'warning',
                title: 'Echec de la demande',
                description: toErrorMessage(response.status, result.error),
            })
        } catch {
            setError('Erreur reseau. Verifiez votre connexion.')
            show({
                variant: 'error',
                title: 'Erreur reseau',
                description: 'Impossible de joindre le serveur. Verifiez votre connexion.',
            })
        } finally {
            setLoading(false)
            pendingRef.current = false
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
                    <p>{success}</p>
                </div>
            )}
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
                    {error}
                </div>
            )}

            {isAuthenticated ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                    <p className="font-medium">Connecte en tant que {defaultName}</p>
                    <p className="opacity-90">{defaultEmail}</p>
                    <p className="mt-2 text-xs opacity-90">
                        Apres envoi, vous serez redirige vers votre espace pour echanger avec le proprietaire.
                    </p>
                </div>
            ) : (
                <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                        <p className="font-medium">Inscription requise apres la demande</p>
                        <p className="mt-1 text-xs opacity-90">
                            Envoyez votre demande, puis creez un compte locataire pour acceder a votre espace de
                            messagerie avec le proprietaire. Si vous avez deja un compte, connectez-vous ensuite.
                        </p>
                    </div>
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
                                required
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
                                required
                            />
                        </div>
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="requesterPhone">Telephone (optionnel)</Label>
                    <Input
                        id="requesterPhone"
                        name="requesterPhone"
                        placeholder="+22997000000"
                        inputMode="tel"
                        pattern="^\\+?[0-9 ()\\.-]{8,25}$"
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
                {loading ? 'Envoi...' : 'Envoyer ma demande'}
            </Button>
            {!isAuthenticated ? (
                <p className="text-xs text-secondary text-center">
                    Deja un compte ?{' '}
                    <Link
                        href={locale ? `/${locale}/login?profile=tenant` : '/login?profile=tenant'}
                        className="text-primary underline underline-offset-2"
                    >
                        Se connecter
                    </Link>
                    {' · '}
                    <Link
                        href={locale ? `/${locale}/register?profile=tenant` : '/register?profile=tenant'}
                        className="text-primary underline underline-offset-2"
                    >
                        Creer un compte
                    </Link>
                </p>
            ) : null}
        </form>
    )
}
