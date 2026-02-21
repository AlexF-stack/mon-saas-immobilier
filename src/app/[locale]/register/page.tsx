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
import { validatePasswordComplexity } from '@/lib/auth-policy'

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
        const role = selectedRole

        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        if (!isValidEmail) {
            setLoading(false)
            setError('Email invalide.')
            return
        }

        if (!validatePasswordComplexity(password)) {
            setLoading(false)
            setError('Mot de passe trop faible: 8+ caractères, majuscule, minuscule, chiffre et caractère spécial.')
            return
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, role }),
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
                            <Label htmlFor="password">{t('auth.password')}</Label>
                            <Input id="password" name="password" type="password" required />
                            <p className="text-xs text-secondary">
                                8+ chars, upper/lower case, number, special char.
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
