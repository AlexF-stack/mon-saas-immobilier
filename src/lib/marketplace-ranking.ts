const DAY_IN_MS = 24 * 60 * 60 * 1000

const PREMIUM_BOOST = 8
const IMAGE_BOOST = 2
const VIEW_WEIGHT = 1.8
const INQUIRY_WEIGHT = 3.5
const CONVERSION_WEIGHT = 10
const STALENESS_PENALTY_PER_DAY = 0.12

export const RECOMMENDED_STALE_AFTER_DAYS = Number.parseInt(
    process.env.MARKETPLACE_STALE_AFTER_DAYS ?? '45',
    10
)

export const MAX_RECOMMENDED_RERANK_CANDIDATES = Number.parseInt(
    process.env.MARKETPLACE_MAX_RERANK_CANDIDATES ?? '400',
    10
)

export type MarketplaceRankSignals = {
    isPremium: boolean
    viewsCount: number
    inquiriesCount: number
    publishedAt: Date | null
    createdAt: Date
    images: Array<{ id: string; url: string }>
}

function ageInDays(signal: MarketplaceRankSignals, nowMs: number) {
    const baseDate = signal.publishedAt ?? signal.createdAt
    return Math.max(0, (nowMs - baseDate.getTime()) / DAY_IN_MS)
}

export function computeRecommendedScore(
    signal: MarketplaceRankSignals,
    nowMs = Date.now()
): number {
    const views = Math.max(0, signal.viewsCount)
    const inquiries = Math.max(0, signal.inquiriesCount)
    const conversionRate = views > 0 ? inquiries / views : inquiries > 0 ? 1 : 0
    const days = ageInDays(signal, nowMs)
    const stalenessPenalty =
        days > RECOMMENDED_STALE_AFTER_DAYS
            ? (days - RECOMMENDED_STALE_AFTER_DAYS) * STALENESS_PENALTY_PER_DAY
            : 0

    return (
        (signal.isPremium ? PREMIUM_BOOST : 0) +
        (signal.images.length > 0 ? IMAGE_BOOST : 0) +
        Math.log1p(views) * VIEW_WEIGHT +
        Math.log1p(inquiries) * INQUIRY_WEIGHT +
        Math.min(conversionRate, 1.5) * CONVERSION_WEIGHT -
        stalenessPenalty
    )
}

export function rankPropertiesByRecommendedScore<T extends MarketplaceRankSignals>(properties: T[]) {
    const nowMs = Date.now()
    return properties
        .map((property) => ({
            ...property,
            recommendedScore: computeRecommendedScore(property, nowMs),
        }))
        .sort((a, b) => {
            if (b.recommendedScore !== a.recommendedScore) {
                return b.recommendedScore - a.recommendedScore
            }
            if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1
            if (a.inquiriesCount !== b.inquiriesCount) return b.inquiriesCount - a.inquiriesCount
            if (a.viewsCount !== b.viewsCount) return b.viewsCount - a.viewsCount
            const bDate = (b.publishedAt ?? b.createdAt).getTime()
            const aDate = (a.publishedAt ?? a.createdAt).getTime()
            return bDate - aDate
        })
}
