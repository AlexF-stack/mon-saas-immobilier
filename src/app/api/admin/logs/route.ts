import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const actor = await verifyAuth(token)
        if (!actor || actor.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const url = new URL(request.url)
        const limitQuery = Number(url.searchParams.get('limit') ?? 100)
        const limit = Number.isFinite(limitQuery)
            ? Math.max(1, Math.min(Math.floor(limitQuery), 300))
            : 100

        const logs = await prisma.systemLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return NextResponse.json(logs)
    } catch (error) {
        console.error('Logs fetch error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
