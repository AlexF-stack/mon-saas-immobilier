'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
    const locale = useLocale()
    const t = useTranslations()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [devResetUrl, setDevResetUrl] = useState('')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setMessage('')
        setDevResetUrl('')
        setLoading(true)

        const formData = new FormData(event.currentTarget)
        const email = String(formData.get('email') ?? '').trim()

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, locale }),
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data.error ?? t('common.error'))
                return
            }

            setMessage(
                data.message ??
                    'Si le compte existe, un lien de reinitialisation a ete envoye.'
            )
            if (typeof data.resetUrl === 'string') {
                setDevResetUrl(data.resetUrl)
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
                <CardHeader className="space-y-2">
                    <CardTitle>{t('auth.forgotPassword')}</CardTitle>
                    <p className="text-sm text-secondary">
                        Entrez votre email pour recevoir un lien de reinitialisation.
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
                            <Label htmlFor="email">{t('auth.email')}</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="you@example.com"
                            />
                        </div>

                        {devResetUrl ? (
                            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-secondary">
                                <p className="mb-1 font-semibold text-primary">Dev reset URL:</p>
                                <a
                                    href={devResetUrl}
                                    className="break-all text-primary hover:underline"
                                >
                                    {devResetUrl}
                                </a>
                            </div>
                        ) : null}
                    </CardContent>
                    <CardFooter className="flex flex-col items-stretch gap-3">
                        <Button
                            type="submit"
                            variant="cta"
                            loading={loading}
                            loadingText={t('common.loading')}
                        >
                            {t('auth.forgotPassword')}
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
