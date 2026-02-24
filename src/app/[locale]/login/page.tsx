'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Home, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ThemeToggle from '@/components/ui/theme-toggle'

type LoginField = 'email' | 'password' | 'form'
type LoginFieldErrors = Partial<Record<LoginField, string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getLocalizedRedirectPath(locale: string, redirectTo: string): string {
  const normalizedPath = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
  const localePrefix = `/${locale}`

  if (normalizedPath === localePrefix || normalizedPath.startsWith(`${localePrefix}/`)) {
    return normalizedPath
  }

  return `${localePrefix}${normalizedPath}`
}

function mapBackendErrorToField(message: string): LoginField {
  const normalized = message.toLowerCase()
  if (normalized.includes('email')) return 'email'
  if (
    normalized.includes('password') ||
    normalized.includes('credentials') ||
    normalized.includes('identifiant') ||
    normalized.includes('mot de passe')
  ) {
    return 'password'
  }
  return 'form'
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginFieldErrors>({})

  const oauthError = searchParams.get('error')
  const oauthErrorMessage =
    oauthError === 'oauth_not_configured'
      ? 'Connexion sociale indisponible: configuration manquante.'
      : oauthError === 'oauth_denied'
        ? 'Connexion sociale annulee.'
        : oauthError
          ? 'Echec de la connexion sociale. Reessayez.'
          : ''

  const highlights = useMemo(
    () =>
      locale === 'fr'
        ? [
            'Suivi des loyers et paiements en temps reel',
            'Baux, quittances et notifications centralises',
            'Acces securise pour proprietaires et locataires',
          ]
        : [
            'Real-time rent and payment monitoring',
            'Leases, receipts and notifications in one workspace',
            'Secure access for owners and tenants',
          ],
    [locale]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: LoginFieldErrors = {}

    if (!EMAIL_REGEX.test(values.email.trim())) {
      nextErrors.email = locale === 'fr' ? 'Email invalide.' : 'Invalid email address.'
    }
    if (!values.password) {
      nextErrors.password =
        locale === 'fr' ? 'Le mot de passe est obligatoire.' : 'Password is required.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const redirectTo = typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard'
        router.push(getLocalizedRedirectPath(locale, redirectTo))
        await router.refresh()
        return
      }

      const data = await res.json().catch(() => null)
      const backendError =
        typeof data?.error === 'string' && data.error.trim()
          ? data.error
          : t('auth.invalidCredentials')
      const targetField = mapBackendErrorToField(backendError)
      setErrors({ [targetField]: backendError })
    } catch {
      setErrors({ form: t('common.error') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-primary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgb(var(--primary)/0.18),transparent_42%),radial-gradient(circle_at_84%_84%,rgb(var(--accent)/0.16),transparent_40%)]" />

      <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        <aside className="relative hidden px-8 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-card">
              <Home className="h-6 w-6" />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                ImmoSaaS
              </p>
              <h1 className="max-w-md text-4xl font-semibold leading-tight">
                {locale === 'fr'
                  ? 'Votre plateforme immobiliere en mode operationnel.'
                  : 'Your real-estate operations platform.'}
              </h1>
              <p className="max-w-md text-sm text-secondary">
                {locale === 'fr'
                  ? 'Connectez-vous pour piloter paiements, baux et rentabilite depuis un espace unifie.'
                  : 'Sign in to manage payments, leases and profitability from one unified workspace.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {highlights.map((item) => (
              <p key={item} className="flex items-start gap-2 text-sm text-secondary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </aside>

        <main className="flex items-center justify-center px-4 py-12 sm:px-8">
          <Card className="glass-card animate-fade-up w-full max-w-md border-border bg-card/85 shadow-2xl shadow-primary/10">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl font-semibold">{t('auth.login')}</CardTitle>
              <CardDescription className="text-sm text-secondary">
                {locale === 'fr'
                  ? 'Accedez a votre espace locataire, manager ou administrateur.'
                  : 'Access your tenant, manager or administrator workspace.'}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {oauthErrorMessage ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    {oauthErrorMessage}
                  </p>
                ) : null}
                {errors.form ? (
                  <p className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errors.form}</span>
                  </p>
                ) : null}

                <div className="space-y-1">
                  <div className="auth-field">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder=" "
                      value={values.email}
                      aria-invalid={Boolean(errors.email)}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, email: event.target.value }))
                      }
                      className="auth-input h-12 pl-11"
                    />
                    <Mail className="auth-field-icon" />
                    <Label htmlFor="email" className="auth-floating-label">
                      {t('auth.email')}
                    </Label>
                  </div>
                  {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
                </div>

                <div className="space-y-1">
                  <div className="auth-field">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder=" "
                      value={values.password}
                      aria-invalid={Boolean(errors.password)}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, password: event.target.value }))
                      }
                      className="auth-input h-12 pl-11 pr-11"
                    />
                    <Lock className="auth-field-icon" />
                    <Label htmlFor="password" className="auth-floating-label">
                      {t('auth.password')}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface hover:text-primary"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  ) : null}
                </div>

                <div className="text-right">
                  <Link href={`/${locale}/forgot-password`} className="text-xs font-medium text-primary hover:underline">
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="cta"
                  size="lg"
                  className="h-12 w-full text-base"
                  loading={loading}
                  loadingText={`${t('common.loading')}...`}
                >
                  {t('auth.login')}
                </Button>

                <p className="inline-flex items-center gap-2 text-xs text-secondary">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {locale === 'fr'
                    ? 'Vos donnees sont chiffrees et securisees.'
                    : 'Your data is encrypted and secured.'}
                </p>

                <p className="text-center text-sm text-secondary">
                  {t('auth.noAccount')}{' '}
                  <Link href={`/${locale}/register`} className="font-semibold text-primary hover:underline">
                    {t('auth.registerHere')}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </main>
      </div>
    </div>
  )
}
