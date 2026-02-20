export type SupportedLocale = 'fr' | 'en'

export type LocalizedText = {
    fr: string
    en: string
}

export type LandingPricingPlanKey = 'basic' | 'pro' | 'premium'

export type LandingPricingPlanSeed = {
    key: LandingPricingPlanKey
    configKey: string
    name: LocalizedText
    description: LocalizedText
    price: LocalizedText
    cadence: LocalizedText
    ctaLabel: LocalizedText
    ctaHref: string
    note: LocalizedText
    popular: boolean
    features: LocalizedText[]
}

export const LANDING_PRICING_PLAN_SEEDS: LandingPricingPlanSeed[] = [
    {
        key: 'basic',
        configKey: 'LANDING_PRICING_BASIC',
        name: { fr: 'Basic', en: 'Basic' },
        description: {
            fr: 'Pour les utilisateurs legers qui veulent explorer la plateforme.',
            en: 'For light usage and first discovery.',
        },
        price: { fr: 'Gratuit', en: 'Free' },
        cadence: { fr: '0 FCFA / mois', en: '0 FCFA / month' },
        ctaLabel: { fr: 'Essayer gratuitement', en: 'Start for free' },
        ctaHref: '/register',
        note: {
            fr: 'Micro-info: jusqua 10 demandes marketplace par mois.',
            en: 'Info: up to 10 marketplace inquiries per month.',
        },
        popular: false,
        features: [
            {
                fr: 'Visualisation des biens disponibles',
                en: 'Published property browsing',
            },
            {
                fr: 'Formulaire de demande limite',
                en: 'Limited inquiry forms',
            },
            {
                fr: 'Acces rapide a la marketplace',
                en: 'Quick marketplace access',
            },
        ],
    },
    {
        key: 'pro',
        configKey: 'LANDING_PRICING_PRO',
        name: { fr: 'Pro', en: 'Pro' },
        description: {
            fr: 'Pour proprietaires et managers qui gerent activement leur parc.',
            en: 'For owners and managers with active operations.',
        },
        price: { fr: '19 900 FCFA', en: '19 900 FCFA' },
        cadence: { fr: 'par mois', en: 'per month' },
        ctaLabel: { fr: 'Sinscrire sur Pro', en: 'Choose Pro' },
        ctaHref: '/register',
        note: {
            fr: 'Micro-info: gestion de 10 proprietes max incluse.',
            en: 'Info: up to 10 managed properties included.',
        },
        popular: true,
        features: [
            {
                fr: 'Creation et gestion des proprietes',
                en: 'Property creation and management',
            },
            {
                fr: 'Contrats et quittances automatises',
                en: 'Contracts and receipt generation',
            },
            {
                fr: 'Paiements integres et suivi',
                en: 'Integrated payments and tracking',
            },
        ],
    },
    {
        key: 'premium',
        configKey: 'LANDING_PRICING_PREMIUM',
        name: { fr: 'Premium', en: 'Premium' },
        description: {
            fr: 'Pour une exploitation complete avec analytics et reporting avance.',
            en: 'For full-scale operations with advanced analytics.',
        },
        price: { fr: '49 900 FCFA', en: '49 900 FCFA' },
        cadence: { fr: 'par mois', en: 'per month' },
        ctaLabel: { fr: 'Passer en Premium', en: 'Go Premium' },
        ctaHref: '/register',
        note: {
            fr: 'Micro-info: support prioritaire et stats globales inclus.',
            en: 'Info: priority support and global analytics included.',
        },
        popular: false,
        features: [
            {
                fr: 'Marketplace complete avec publication avancee',
                en: 'Advanced marketplace publishing',
            },
            {
                fr: 'Reporting de rentabilite et KPI',
                en: 'Profitability reporting and KPIs',
            },
            {
                fr: 'Paiements, audit et supervision complete',
                en: 'Payments, audit and full oversight',
            },
        ],
    },
]

export type LandingPricingTemplateRow = {
    key: string
    value: string
    description: string
}

export const LANDING_PRICING_TEMPLATE_ROWS: LandingPricingTemplateRow[] =
    LANDING_PRICING_PLAN_SEEDS.map((plan) => ({
        key: plan.configKey,
        description: `Landing pricing config for ${plan.name.en}`,
        value: JSON.stringify(
            {
                name: plan.name,
                description: plan.description,
                price: plan.price,
                cadence: plan.cadence,
                ctaLabel: plan.ctaLabel,
                ctaHref: plan.ctaHref,
                note: plan.note,
                popular: plan.popular,
                features: {
                    fr: plan.features.map((feature) => feature.fr),
                    en: plan.features.map((feature) => feature.en),
                },
            },
            null,
            2
        ),
    }))
