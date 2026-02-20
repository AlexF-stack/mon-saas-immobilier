import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const url = new URL(request.url)
        const limitQuery = Number(url.searchParams.get('limit') ?? 10)
        const limit = Number.isFinite(limitQuery)
            ? Math.max(1, Math.min(Math.floor(limitQuery), 30))
            : 10

        const history = await prisma.loginHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                ipAddress: true,
                userAgent: true,
                success: true,
                createdAt: true,
            },
        })

        return NextResponse.json(history)
    } catch (error) {
        console.error('Login history fetch error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
