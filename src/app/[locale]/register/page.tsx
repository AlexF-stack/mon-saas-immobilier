'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertCircle, Building2, CheckCircle2, Home, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { validatePasswordComplexity } from '@/lib/auth-policy'
import ThemeToggle from '@/components/ui/theme-toggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'

type RegisterRole = 'LOCATAIRE' | 'PROPRIETAIRE'
type RegisterField = 'name' | 'email' | 'password' | 'role' | 'form'
type RegisterErrors = Partial<Record<RegisterField, string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function mapBackendErrorToField(message: string): RegisterField {
  const normalized = message.toLowerCase()
  if (normalized.includes('email')) return 'email'
  if (normalized.includes('password') || normalized.includes('mot de passe')) return 'password'
  if (normalized.includes('name') || normalized.includes('nom')) return 'name'
  if (normalized.includes('role')) return 'role'
  return 'form'
}

function getPasswordScore(value: string) {
  let score = 0
  if (value.length >= 8) score += 1
  if (/[A-Z]/.test(value)) score += 1
  if (/[a-z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
  })

  const profileParam = searchParams.get('profile')
  const selectedRole: RegisterRole | null =
    profileParam === 'tenant' ? 'LOCATAIRE' : profileParam === 'owner' ? 'PROPRIETAIRE' : null

  const passwordScore = getPasswordScore(values.password)
  const passwordStrength = useMemo(() => {
    if (!values.password) {
      return locale === 'fr' ? 'Saisissez un mot de passe.' : 'Enter a password.'
    }
    if (passwordScore <= 2) return locale === 'fr' ? 'Faible' : 'Weak'
    if (passwordScore <= 4) return locale === 'fr' ? 'Moyen' : 'Medium'
    return locale === 'fr' ? 'Fort' : 'Strong'
  }, [locale, passwordScore, values.password])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const role = selectedRole
    const nextErrors: RegisterErrors = {}

    if (!role) {
      nextErrors.role =
        locale === 'fr' ? 'Selectionnez un espace avant inscription.' : 'Choose a workspace first.'
    }
    if (!values.name.trim()) {
      nextErrors.name = locale === 'fr' ? 'Le nom est obligatoire.' : 'Name is required.'
    }
    if (!EMAIL_REGEX.test(values.email.trim())) {
      nextErrors.email = locale === 'fr' ? 'Email invalide.' : 'Invalid email address.'
    }
    if (!validatePasswordComplexity(values.password)) {
      nextErrors.password =
        locale === 'fr'
          ? '8+ caracteres, majuscule, minuscule, chiffre et caractere special.'
          : 'Use 8+ chars with upper/lowercase, number and special character.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          name: values.name.trim(),
          role,
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok) {
        const redirectTo = typeof data?.redirectTo === 'string' ? data.redirectTo : '/dashboard'
        router.push(getLocalizedRedirectPath(locale, redirectTo))
        router.refresh()
        return
      }

      const backendMessage = getErrorMessage(data?.error, t('common.error'))
      const field = mapBackendErrorToField(backendMessage)
      setErrors({ [field]: backendMessage })
    } catch {
      setErrors({ form: t('common.error') })
    } finally {
      setLoading(false)
    }
  }

  if (!selectedRole) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-background px-4 py-8 text-primary">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgb(var(--primary)/0.17),transparent_44%),radial-gradient(circle_at_84%_84%,rgb(var(--accent)/0.15),transparent_42%)]" />
        <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center">
          <Card className="glass-card animate-fade-up w-full max-w-2xl border-border bg-card/85 shadow-2xl shadow-primary/10">
            <CardHeader className="space-y-3 text-center">
              <CardTitle className="text-2xl font-semibold sm:text-3xl">
                {locale === 'fr' ? 'Choisissez votre espace' : 'Choose your workspace'}
              </CardTitle>
              <CardDescription className="text-sm text-secondary">
                {locale === 'fr'
                  ? 'Selectionnez votre profil avant de creer un compte.'
                  : 'Select your profile before creating an account.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Link href={`/${locale}/register?profile=tenant`} className="group">
                <article className="h-full rounded-2xl border border-border bg-card/80 p-4 transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--primary)/0.12)] text-primary">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <p className="font-semibold text-primary">{locale === 'fr' ? 'Locataire' : 'Tenant'}</p>
                  <p className="mt-1 text-sm text-secondary">
                    {locale === 'fr'
                      ? 'Suivez vos paiements, quittances et contrat de bail.'
                      : 'Track your payments, receipts and lease contract.'}
                  </p>
                </article>
              </Link>
              <Link href={`/${locale}/register?profile=owner`} className="group">
                <article className="h-full rounded-2xl border border-border bg-card/80 p-4 transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-accent">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <p className="font-semibold text-primary">
                    {locale === 'fr' ? 'Proprietaire / Manager' : 'Owner / Manager'}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {locale === 'fr'
                      ? 'Gerez vos biens, baux, locataires et paiements.'
                      : 'Manage properties, leases, tenants and payments.'}
                  </p>
                </article>
              </Link>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/login`}>
                  {locale === 'fr' ? 'Connexion directe' : 'Go to login'}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  const roleLabel =
    selectedRole === 'LOCATAIRE'
      ? locale === 'fr'
        ? 'Locataire'
        : 'Tenant'
      : locale === 'fr'
        ? 'Proprietaire / Gestionnaire'
        : 'Owner / Manager'

  const highlights =
    locale === 'fr'
      ? ['Onboarding rapide des utilisateurs', 'Acces role-based securise', 'Automatisation des paiements']
      : ['Fast user onboarding', 'Secure role-based access', 'Payment workflow automation']

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
                  ? 'Creez votre compte et activez votre espace metier.'
                  : 'Create your account and activate your workspace.'}
              </h1>
              <p className="max-w-md text-sm text-secondary">
                {locale === 'fr'
                  ? 'Profil selectionne: '
                  : 'Selected profile: '}
                <span className="font-semibold text-primary">{roleLabel}</span>
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
              <CardTitle className="text-3xl font-semibold">{t('auth.register')}</CardTitle>
              <CardDescription className="text-sm text-secondary">{t('auth.createAccount')}</CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {errors.form ? (
                  <p className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errors.form}</span>
                  </p>
                ) : null}

                <div className="space-y-1">
                  <div className="auth-field">
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder=" "
                      value={values.name}
                      aria-invalid={Boolean(errors.name)}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, name: event.target.value }))
                      }
                      className="auth-input h-12"
                    />
                    <Label htmlFor="name" className="auth-floating-label auth-floating-label-no-icon">
                      {t('auth.name')}
                    </Label>
                  </div>
                  {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
                </div>

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
                      type="password"
                      autoComplete="new-password"
                      placeholder=" "
                      value={values.password}
                      aria-invalid={Boolean(errors.password)}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, password: event.target.value }))
                      }
                      className="auth-input h-12 pl-11"
                    />
                    <Lock className="auth-field-icon" />
                    <Label htmlFor="password" className="auth-floating-label">
                      {t('auth.password')}
                    </Label>
                  </div>
                  {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}

                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className={[
                          'h-full rounded-full transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)]',
                          passwordScore <= 2 ? 'bg-rose-500' : passwordScore <= 4 ? 'bg-amber-500' : 'bg-emerald-500',
                        ].join(' ')}
                        style={{ width: `${(passwordScore / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-secondary">
                      {locale === 'fr' ? 'Force du mot de passe: ' : 'Password strength: '}
                      <span className="font-semibold text-primary">{passwordStrength}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-secondary">{t('dashboard.profile')}</Label>
                  <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-primary">
                    {roleLabel}
                  </div>
                  {errors.role ? <p className="text-xs text-destructive">{errors.role}</p> : null}
                  <Link href={`/${locale}/register`} className="inline-flex text-xs font-medium text-primary hover:underline">
                    {locale === 'fr' ? 'Changer d espace' : 'Change workspace'}
                  </Link>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="h-12 w-full text-base"
                  loading={loading}
                  loadingText={`${t('common.loading')}...`}
                >
                  {t('auth.register')}
                </Button>

                <p className="inline-flex items-center gap-2 text-xs text-secondary">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {locale === 'fr'
                    ? 'Vos donnees sont chiffrees et securisees.'
                    : 'Your data is encrypted and secured.'}
                </p>

                <p className="text-center text-sm text-secondary">
                  {t('auth.haveAccount')}{' '}
                  <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">
                    {t('auth.loginHere')}
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
