import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    LANDING_PRICING_PLAN_SEEDS,
    type LandingPricingPlanKey,
    type LocalizedText,
    type SupportedLocale,
} from '@/lib/landing-pricing-config'

const localizedTextSchema = z
    .object({
        fr: z.string().trim().min(1).max(300).optional(),
        en: z.string().trim().min(1).max(300).optional(),
    })
    .strict()

const localizedTextOrStringSchema = z.union([
    z.string().trim().min(1).max(300),
    localizedTextSchema,
])

const localizedFeaturesSchema = z
    .object({
        fr: z.array(z.string().trim().min(1).max(180)).min(1).max(12).optional(),
        en: z.array(z.string().trim().min(1).max(180)).min(1).max(12).optional(),
    })
    .strict()

const pricingPlanOverrideSchema = z
    .object({
        name: localizedTextOrStringSchema.optional(),
        description: localizedTextOrStringSchema.optional(),
        price: localizedTextOrStringSchema.optional(),
        cadence: localizedTextOrStringSchema.optional(),
        ctaLabel: localizedTextOrStringSchema.optional(),
        ctaHref: z.string().trim().min(1).max(240).optional(),
        note: localizedTextOrStringSchema.optional(),
        popular: z.boolean().optional(),
        features: z
            .union([
                z.array(z.string().trim().min(1).max(180)).min(1).max(12),
                localizedFeaturesSchema,
            ])
            .optional(),
    })
    .passthrough()

type PricingPlanOverride = z.infer<typeof pricingPlanOverrideSchema>

export type LandingPricingPlan = {
    key: LandingPricingPlanKey
    name: string
    description: string
    price: string
    cadence: string
    ctaLabel: string
    ctaHref: string
    note: string
    popular: boolean
    features: string[]
}

function normalizeLocale(locale: string): SupportedLocale {
    return locale === 'fr' ? 'fr' : 'en'
}

function resolveLocalized(
    value: string | Partial<LocalizedText> | undefined,
    locale: SupportedLocale,
    fallback: string
): string {
    if (!value) return fallback
    if (typeof value === 'string') return value

    const chosen = value[locale] ?? value.fr ?? value.en
    if (typeof chosen === 'string' && chosen.trim().length > 0) {
        return chosen
    }
    return fallback
}

function resolveFeatures(
    value: string[] | { fr?: string[]; en?: string[] } | undefined,
    locale: SupportedLocale,
    fallback: string[]
): string[] {
    if (!value) return fallback
    if (Array.isArray(value)) {
        return value.length > 0 ? value : fallback
    }
    const localized = value[locale] ?? value.fr ?? value.en
    return localized && localized.length > 0 ? localized : fallback
}

function withLocalePrefix(locale: SupportedLocale, href: string): string {
    if (href.startsWith('http://') || href.startsWith('https://')) {
        return href
    }
    const normalized = href.startsWith('/') ? href : `/${href}`
    const localePrefix = `/${locale}`
    if (normalized === localePrefix || normalized.startsWith(`${localePrefix}/`)) {
        return normalized
    }
    return `${localePrefix}${normalized}`
}

function parseOverride(rawValue: string): PricingPlanOverride | null {
    const trimmed = rawValue.trim()
    if (!trimmed) return null

    // Allow plain string values for quick admin price overrides.
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return { price: trimmed }
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown
        const result = pricingPlanOverrideSchema.safeParse(parsed)
        return result.success ? result.data : null
    } catch {
        return null
    }
}

export async function getLandingPricingPlans(
    locale: string
): Promise<LandingPricingPlan[]> {
    const normalizedLocale = normalizeLocale(locale)
    const configKeys = LANDING_PRICING_PLAN_SEEDS.map((plan) => plan.configKey)

    const configRows = await prisma.systemConfig.findMany({
        where: { key: { in: configKeys } },
        select: { key: true, value: true },
    })

    const configMap = new Map(configRows.map((row) => [row.key, row.value]))

    return LANDING_PRICING_PLAN_SEEDS.map((seed) => {
        const override = parseOverride(configMap.get(seed.configKey) ?? '')
        const defaultFeatures = seed.features.map(
            (feature) => feature[normalizedLocale]
        )

        return {
            key: seed.key,
            name: resolveLocalized(
                override?.name,
                normalizedLocale,
                seed.name[normalizedLocale]
            ),
            description: resolveLocalized(
                override?.description,
                normalizedLocale,
                seed.description[normalizedLocale]
            ),
            price: resolveLocalized(
                override?.price,
                normalizedLocale,
                seed.price[normalizedLocale]
            ),
            cadence: resolveLocalized(
                override?.cadence,
                normalizedLocale,
                seed.cadence[normalizedLocale]
            ),
            ctaLabel: resolveLocalized(
                override?.ctaLabel,
                normalizedLocale,
                seed.ctaLabel[normalizedLocale]
            ),
            ctaHref: withLocalePrefix(
                normalizedLocale,
                override?.ctaHref ?? seed.ctaHref
            ),
            note: resolveLocalized(
                override?.note,
                normalizedLocale,
                seed.note[normalizedLocale]
            ),
            popular: override?.popular ?? seed.popular,
            features: resolveFeatures(
                override?.features,
                normalizedLocale,
                defaultFeatures
            ),
        }
    })
}
