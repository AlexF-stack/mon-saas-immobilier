'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { validateRegistrationPassword } from '@/lib/auth-policy'

function getErrorMessage(errorPayload: unknown, fallback: string): string {
    if (typeof errorPayload === 'string' && errorPayload.trim()) {
        return errorPayload
    }

    if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
        return String(errorPayload[0].message)
    }

    return fallback
}

function getLocalizedRedirectPath(locale: string, redirectTo: string): string {
    const normalizedPath = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
    const localePrefix = `/${locale}`

    if (normalizedPath === localePrefix || normalizedPath.startsWith(`${localePrefix}/`)) {
        return normalizedPath
    }

    return `${localePrefix}${normalizedPath}`
}

export default function RegisterPage() {
    const router = useRouter()
    const locale = useLocale()
    const t = useTranslations()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedRole, setSelectedRole] = useState<'LOCATAIRE' | 'PROPRIETAIRE'>('LOCATAIRE')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(event.currentTarget)
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')
        const name = String(formData.get('name') ?? '').trim()
        const phone = String(formData.get('phone') ?? '').trim()
        const role = selectedRole
        const rentalTerms = String(formData.get('rentalTerms') ?? '').trim()

        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        if (!isValidEmail) {
            setLoading(false)
            setError('Email invalide.')
            return
        }

        if (!validateRegistrationPassword(password)) {
            setLoading(false)
            setError('Mot de passe trop court (minimum 6 caracteres).')
            return
        }

        const phoneRegex = /^\+?[0-9\s().-]{8,25}$/
        if (!phoneRegex.test(phone)) {
            setLoading(false)
            setError('Numero de telephone invalide.')
            return
        }

        if (role === 'PROPRIETAIRE' && rentalTerms.length < 20) {
            setLoading(false)
            setError('Veuillez renseigner vos conditions de contrat avant de creer un compte proprietaire (minimum 20 caracteres).')
            return
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    phone,
                    role,
                    rentalTerms: role === 'PROPRIETAIRE' ? rentalTerms : undefined,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                const redirectTo = typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard'
                router.push(getLocalizedRedirectPath(locale, redirectTo))
                router.refresh()
            } else {
                setError(getErrorMessage(data.error, t('common.error')))
            }
        } catch {
            setError(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 text-primary">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{t('auth.register')}</CardTitle>
                    <CardDescription>{t('auth.createAccount')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && <div className="text-danger text-sm">{error}</div>}
                        <div className="space-y-2">
                            <Label htmlFor="name">{t('auth.name')}</Label>
                            <Input id="name" name="name" placeholder="John Doe" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">{t('auth.email')}</Label>
                            <Input id="email" name="email" type="email" placeholder="john@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telephone</Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                placeholder="+22997000000"
                                pattern="^\\+?[0-9 ()\\.-]{8,25}$"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">{t('auth.password')}</Label>
                            <Input id="password" name="password" type="password" required />
                            <p className="text-xs text-secondary">
                                Minimum 6 caracteres.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">{t('dashboard.profile')}</Label>
                            <Select name="role" value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'LOCATAIRE' | 'PROPRIETAIRE')}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('common.loading')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOCATAIRE">{locale === 'fr' ? 'Locataire' : 'Tenant'}</SelectItem>
                                    <SelectItem value="PROPRIETAIRE">{locale === 'fr' ? 'Proprietaire / Gestionnaire' : 'Owner / Manager'}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedRole === 'PROPRIETAIRE' && (
                            <div className="space-y-3 rounded-xl border border-border bg-surface/50 p-4">
                                <div className="space-y-1">
                                    <Label htmlFor="rentalTerms">Conditions de contrat</Label>
                                    <p className="text-xs text-secondary">
                                        Obligatoire avant creation du compte proprietaire. Ce texte servira de base contractuelle par defaut dans vos nouveaux contrats.
                                    </p>
                                </div>
                                <Textarea
                                    id="rentalTerms"
                                    name="rentalTerms"
                                    required
                                    minLength={20}
                                    maxLength={5000}
                                    placeholder="Ex: depot de garantie, modalites de paiement, obligations du locataire, penalites de retard, preavis, conditions de resiliation..."
                                />
                                <p className="text-xs text-secondary">
                                    Sans ces conditions, le compte proprietaire ne peut pas etre cree.
                                </p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2">
                        <Button
                            type="submit"
                            className="w-full"
                            loading={loading}
                            loadingText={`${t('common.loading')}...`}
                        >
                            {t('auth.register')}
                        </Button>
                        <div className="text-sm text-center text-secondary">
                            {t('auth.haveAccount')}{' '}
                            <Link href={`/${locale}/login`} className="text-primary hover:underline">
                                {t('auth.loginHere')}
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
