import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { verifyAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ActionCard = {
  title: string
  description: string
  href: string
  icon: typeof Building2
}

function getRoleLabel(role: string) {
  if (role === 'ADMIN') return 'Administrateur'
  if (role === 'MANAGER') return 'Proprietaire / Manager'
  if (role === 'TENANT') return 'Locataire'
  return 'Utilisateur'
}

export default async function DashboardHomePage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const role = user.role
  const dashboardPrefix = `/${locale}/dashboard`

  const adminCards: ActionCard[] = [
    {
      title: 'Utilisateurs',
      description: 'Gerer les roles, suspensions et acces systeme.',
      href: `${dashboardPrefix}/users`,
      icon: Users,
    },
    {
      title: 'Biens',
      description: 'Superviser les proprietes et leur disponibilite.',
      href: `${dashboardPrefix}/properties`,
      icon: Building2,
    },
    {
      title: 'Paiements',
      description: 'Suivre les transactions et retraits.',
      href: `${dashboardPrefix}/payments`,
      icon: CreditCard,
    },
    {
      title: 'Contrats',
      description: 'Consulter les baux actifs et expirations.',
      href: `${dashboardPrefix}/contracts`,
      icon: FileText,
    },
    {
      title: 'Marketplace',
      description: 'Piloter publication et moderation des annonces.',
      href: `${dashboardPrefix}/marketplace`,
      icon: Store,
    },
    {
      title: 'Logs systeme',
      description: 'Auditer les actions critiques et incidents.',
      href: `${dashboardPrefix}/logs`,
      icon: ShieldCheck,
    },
  ]

  const managerCards: ActionCard[] = [
    {
      title: 'Biens',
      description: 'Creer, modifier et suivre vos proprietes.',
      href: `${dashboardPrefix}/properties`,
      icon: Building2,
    },
    {
      title: 'Locataires',
      description: 'Associer les locataires et suivre leur statut.',
      href: `${dashboardPrefix}/tenants`,
      icon: Users,
    },
    {
      title: 'Contrats',
      description: 'Generer et gerer les baux actifs.',
      href: `${dashboardPrefix}/contracts`,
      icon: FileText,
    },
    {
      title: 'Paiements',
      description: 'Encaissements, retraits et quittances.',
      href: `${dashboardPrefix}/payments`,
      icon: CreditCard,
    },
    {
      title: 'Marketplace',
      description: 'Publier vos biens et suivre les demandes.',
      href: `${dashboardPrefix}/marketplace`,
      icon: Store,
    },
    {
      title: 'Parametres',
      description: 'Profil, securite et preferences.',
      href: `${dashboardPrefix}/settings`,
      icon: Settings,
    },
  ]

  const tenantCards: ActionCard[] = [
    {
      title: 'Contrats',
      description: 'Voir votre bail actif et son historique.',
      href: `${dashboardPrefix}/contracts`,
      icon: FileText,
    },
    {
      title: 'Paiements',
      description: 'Suivre vos paiements et recus.',
      href: `${dashboardPrefix}/payments`,
      icon: CreditCard,
    },
    {
      title: 'Parametres',
      description: 'Mettre a jour votre profil et securite.',
      href: `${dashboardPrefix}/settings`,
      icon: Settings,
    },
  ]

  const cards = role === 'ADMIN' ? adminCards : role === 'MANAGER' ? managerCards : tenantCards

  return (
    <section className="space-y-6">
      <Card className="animate-fade-up overflow-hidden border-border bg-gradient-to-r from-[rgb(var(--card))] via-[rgb(var(--surface))] to-[rgb(var(--surface)/0.7)] dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-blue-950/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Espace de travail
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl dark:text-slate-100">
                Accueil {getRoleLabel(role)}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm text-secondary dark:text-slate-300">
                Accedez rapidement a vos modules metier. Les KPI globaux sont centralises dans l&apos;onglet Statistiques.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {role !== 'TENANT' ? (
                <Button asChild size="sm">
                  <Link href={`${dashboardPrefix}/statistics`}>
                    <BarChart3 className="h-4 w-4" />
                    Voir les statistiques
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href={`${dashboardPrefix}/settings`}>
                  Parametres
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={card.href} className={`animate-fade-up ${index < 6 ? `stagger-${index + 1}` : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription className="text-sm text-secondary">{card.description}</CardDescription>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--primary)/0.12)] text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href={card.href}>
                    Ouvrir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
