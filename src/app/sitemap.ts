import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl, normalizeCitySlug } from '@/lib/marketplace-seo'

const LOCALES = ['en', 'fr'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = getAppBaseUrl()
    const now = new Date()

    const [properties, cities] = await Promise.all([
        prisma.property.findMany({
            where: {
                isPublished: true,
                status: 'AVAILABLE',
            },
            select: {
                id: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 3000,
        }),
        prisma.property.findMany({
            where: {
                isPublished: true,
                status: 'AVAILABLE',
                city: { not: null },
            },
            select: { city: true, updatedAt: true },
            distinct: ['city'],
            orderBy: { city: 'asc' },
            take: 500,
        }),
    ])

    const entries: MetadataRoute.Sitemap = []
    const staticLocaleRoutes = ['', '/marketplace', '/login', '/register']

    for (const locale of LOCALES) {
        for (const route of staticLocaleRoutes) {
            entries.push({
                url: `${baseUrl}/${locale}${route}`,
                lastModified: now,
                changeFrequency: route === '/marketplace' ? 'daily' : 'weekly',
                priority: route === '/marketplace' ? 0.9 : 0.7,
            })
        }

        for (const property of properties) {
            entries.push({
                url: `${baseUrl}/${locale}/marketplace/${property.id}`,
                lastModified: property.updatedAt,
                changeFrequency: 'daily',
                priority: 0.8,
            })
        }

        for (const cityRow of cities) {
            const city = cityRow.city?.trim()
            if (!city) continue
            const citySlug = normalizeCitySlug(city)
            if (!citySlug) continue
            entries.push({
                url: `${baseUrl}/${locale}/marketplace/city/${citySlug}`,
                lastModified: cityRow.updatedAt,
                changeFrequency: 'daily',
                priority: 0.75,
            })
        }
    }

    return entries
}
