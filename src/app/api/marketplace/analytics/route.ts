import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const url = new URL(request.url)
        const windowDaysRaw = Number.parseInt(url.searchParams.get('windowDays') ?? '90', 10)
        const windowDays = Number.isFinite(windowDaysRaw) && windowDaysRaw > 0 ? windowDaysRaw : 90
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

        const whereClause = {
            ...(user.role === 'MANAGER' ? { managerId: user.id } : {}),
            isPublished: true,
            publishedAt: { gte: since },
        }

        const properties = await prisma.property.findMany({
            where: whereClause,
            select: {
                id: true,
                city: true,
                status: true,
                isPremium: true,
                viewsCount: true,
                impressionsCount: true,
                inquiriesCount: true,
                publishedAt: true,
                createdAt: true,
            },
        })

        const propertyIds = properties.map((property) => property.id)
        const firstInquiryByProperty =
            propertyIds.length > 0
                ? await prisma.marketplaceInquiry.groupBy({
                      by: ['propertyId'],
                      where: { propertyId: { in: propertyIds } },
                      _min: { createdAt: true },
                  })
                : []

        const totals = properties.reduce(
            (acc, property) => {
                acc.properties += 1
                acc.views += property.viewsCount
                acc.impressions += property.impressionsCount
                acc.inquiries += property.inquiriesCount
                if (property.isPremium) acc.premium += 1
                if (property.status === 'AVAILABLE') acc.available += 1
                return acc
            },
            {
                properties: 0,
                views: 0,
                impressions: 0,
                inquiries: 0,
                premium: 0,
                available: 0,
            }
        )

        const firstInquiryMap = new Map(
            firstInquiryByProperty.map((entry) => [entry.propertyId, entry._min.createdAt])
        )
        const conversionHours: number[] = []
        for (const property of properties) {
            const firstInquiry = firstInquiryMap.get(property.id)
            if (!firstInquiry) continue
            const start = property.publishedAt ?? property.createdAt
            const duration = (firstInquiry.getTime() - start.getTime()) / (1000 * 60 * 60)
            if (duration >= 0) conversionHours.push(duration)
        }

        const cityBuckets = new Map<string, { views: number; impressions: number; inquiries: number }>()
        for (const property of properties) {
            const city = property.city?.trim()
            if (!city) continue
            const previous = cityBuckets.get(city) ?? { views: 0, impressions: 0, inquiries: 0 }
            cityBuckets.set(city, {
                views: previous.views + property.viewsCount,
                impressions: previous.impressions + property.impressionsCount,
                inquiries: previous.inquiries + property.inquiriesCount,
            })
        }

        const byCity = [...cityBuckets.entries()]
            .map(([city, values]) => ({
                city,
                views: values.views,
                impressions: values.impressions,
                inquiries: values.inquiries,
                ctr: values.impressions > 0 ? (values.views / values.impressions) * 100 : 0,
                inquiryRate: values.views > 0 ? (values.inquiries / values.views) * 100 : 0,
            }))
            .sort((a, b) => b.inquiryRate - a.inquiryRate)

        return NextResponse.json({
            windowDays,
            totals: {
                ...totals,
                ctr: totals.impressions > 0 ? (totals.views / totals.impressions) * 100 : 0,
                inquiryRate: totals.views > 0 ? (totals.inquiries / totals.views) * 100 : 0,
                avgHoursToInquiry:
                    conversionHours.length > 0
                        ? conversionHours.reduce((sum, value) => sum + value, 0) / conversionHours.length
                        : 0,
            },
            byCity,
        })
    } catch (error) {
        console.error('Marketplace analytics error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
