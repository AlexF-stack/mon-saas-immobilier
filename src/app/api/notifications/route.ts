import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const url = new URL(request.url)
        const limitQuery = Number(url.searchParams.get('limit') ?? 20)
        const limit = Number.isFinite(limitQuery)
            ? Math.max(1, Math.min(Math.floor(limitQuery), 100))
            : 20

        const notifications = await prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return NextResponse.json(notifications)
    } catch (error) {
        console.error('Notifications fetch error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
