'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const locale = useLocale()
    const t = useTranslations()
    const token = searchParams.get('token') ?? ''

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setMessage('')

        const formData = new FormData(event.currentTarget)
        const password = String(formData.get('password') ?? '')
        const confirmPassword = String(formData.get('confirmPassword') ?? '')

        if (!token) {
            setError('Token invalide ou manquant.')
            return
        }

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    password,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data.error ?? t('common.error'))
                return
            }

            setMessage('Mot de passe reinitialise avec succes.')
            window.setTimeout(() => {
                router.push(`/${locale}/login`)
            }, 900)
        } catch {
            setError(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 text-primary">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-2">
                    <CardTitle>Reinitialiser le mot de passe</CardTitle>
                    <p className="text-sm text-secondary">
                        Definissez un nouveau mot de passe securise.
                    </p>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error ? (
                            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                {error}
                            </p>
                        ) : null}
                        {message ? (
                            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                                {message}
                            </p>
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="password">{t('auth.password')}</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                            />
                            <p className="text-xs text-secondary">
                                8+ caracteres, majuscule, minuscule, chiffre, caractere special.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col items-stretch gap-3">
                        <Button
                            type="submit"
                            variant="cta"
                            loading={loading}
                            loadingText={t('common.loading')}
                        >
                            Mettre a jour
                        </Button>
                        <Link
                            href={`/${locale}/login`}
                            className="text-center text-sm text-secondary hover:text-primary hover:underline"
                        >
                            {t('auth.loginHere')}
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
