'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Home, Mail, Lock, AlertCircle } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

function getLocalizedRedirectPath(locale: string, redirectTo: string): string {
    const normalizedPath = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
    const localePrefix = `/${locale}`

    if (normalizedPath === localePrefix || normalizedPath.startsWith(`${localePrefix}/`)) {
        return normalizedPath
    }

    return `${localePrefix}${normalizedPath}`
}

export default function LoginPage() {
    const router = useRouter()
    const locale = useLocale()
    const t = useTranslations()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(event.currentTarget)
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })
            
            if (res.ok) {
                const data = await res.json()
                const redirectTo =
                    typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard'
                router.push(getLocalizedRedirectPath(locale, redirectTo))
                await router.refresh()
            } else {
                const data = await res.json()
                setError(data.error || t('auth.invalidCredentials'))
            }
        } catch (err) {
            console.error('Login error:', err)
            setError(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background text-primary">
                <div className="absolute top-4 right-4 z-50">
                    <LanguageSwitcher />
                </div>
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-surface/50 dark:from-primary/10 dark:via-accent/5 dark:to-background" />
            
            {/* Decorative circles */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            
            <Card className="relative z-10 mx-4 w-full max-w-md border-border bg-card backdrop-blur-sm shadow-2xl shadow-primary/10">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                        <Home className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            {t('auth.login')}
                        </CardTitle>
                        <CardDescription className="mt-2 text-base text-secondary">
                            {t('auth.enterCredentials')}
                        </CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-primary">
                                <Mail className="w-4 h-4 text-primary" />
                                {t('auth.email')}
                            </Label>
                            <div className="relative">
                                <Input 
                                    id="email" 
                                    name="email" 
                                    type="email" 
                                    placeholder="admin@example.com" 
                                    required 
                                    className="border-border bg-card pl-10 text-primary placeholder:text-[rgb(var(--text-secondary))] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-primary">
                                <Lock className="w-4 h-4 text-primary" />
                                {t('auth.password')}
                            </Label>
                            <div className="relative">
                                <Input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    required 
                                    className="border-border bg-card pl-10 text-primary placeholder:text-[rgb(var(--text-secondary))] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-4">
                        <Button 
                            type="submit" 
                            variant="cta"
                            size="lg"
                            className="w-full h-12 text-lg" 
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {t('common.loading')}...
                                </span>
                            ) : t('auth.login')}
                        </Button>
                        <div className="text-center text-sm text-secondary">
                            {t('auth.noAccount')}{' '}
                            <Link 
                                href={`/${locale}/register`} 
                                className="text-primary font-semibold hover:underline hover:text-accent transition-colors"
                            >
                                {t('auth.registerHere')}
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )}
