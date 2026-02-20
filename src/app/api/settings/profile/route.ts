import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const profileUpdateSchema = z
    .object({
        name: z.string().trim().min(2).max(120).nullable().optional(),
        phone: z
            .string()
            .trim()
            .regex(/^\+?[0-9\s().-]{8,25}$/, 'Invalid phone number')
            .nullable()
            .optional(),
        avatarUrl: z.string().trim().url().nullable().optional(),
        preferredLanguage: z.enum(['fr', 'en']).optional(),
        notifyEmail: z.boolean().optional(),
        notifySms: z.boolean().optional(),
        notifyPush: z.boolean().optional(),
        twoFactorEnabled: z.boolean().optional(),
        dashboardCompact: z.boolean().optional(),
        companyName: z.string().trim().max(120).nullable().optional(),
        companyLogoUrl: z.string().trim().url().nullable().optional(),
    })
    .strict()

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const profile = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                avatarUrl: true,
                preferredLanguage: true,
                notifyEmail: true,
                notifySms: true,
                notifyPush: true,
                twoFactorEnabled: true,
                dashboardCompact: true,
                companyName: true,
                companyLogoUrl: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json(profile)
    } catch (error) {
        console.error('Settings profile fetch error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const rawPayload = (await request.json()) as Record<string, unknown>
        const payload = profileUpdateSchema.parse(rawPayload)
        const isManagerOrAdmin = user.role === 'MANAGER' || user.role === 'ADMIN'

        if (!isManagerOrAdmin && (payload.companyName !== undefined || payload.companyLogoUrl !== undefined)) {
            return NextResponse.json(
                { error: 'Company settings are restricted to manager/admin roles.' },
                { status: 403 }
            )
        }

        if (!isManagerOrAdmin && payload.dashboardCompact !== undefined) {
            return NextResponse.json(
                { error: 'Dashboard display preference is restricted to manager/admin roles.' },
                { status: 403 }
            )
        }

        const data: {
            name?: string | null
            phone?: string | null
            avatarUrl?: string | null
            preferredLanguage?: 'fr' | 'en'
            notifyEmail?: boolean
            notifySms?: boolean
            notifyPush?: boolean
            twoFactorEnabled?: boolean
            dashboardCompact?: boolean
            companyName?: string | null
            companyLogoUrl?: string | null
        } = {}

        if (payload.name !== undefined) data.name = payload.name && payload.name.length > 0 ? payload.name : null
        if (payload.phone !== undefined) data.phone = payload.phone && payload.phone.length > 0 ? payload.phone : null
        if (payload.avatarUrl !== undefined) data.avatarUrl = payload.avatarUrl && payload.avatarUrl.length > 0 ? payload.avatarUrl : null
        if (payload.preferredLanguage !== undefined) data.preferredLanguage = payload.preferredLanguage
        if (payload.notifyEmail !== undefined) data.notifyEmail = payload.notifyEmail
        if (payload.notifySms !== undefined) data.notifySms = payload.notifySms
        if (payload.notifyPush !== undefined) data.notifyPush = payload.notifyPush
        if (payload.twoFactorEnabled !== undefined) data.twoFactorEnabled = payload.twoFactorEnabled
        if (payload.dashboardCompact !== undefined) data.dashboardCompact = payload.dashboardCompact
        if (payload.companyName !== undefined) data.companyName = payload.companyName && payload.companyName.length > 0 ? payload.companyName : null
        if (payload.companyLogoUrl !== undefined) data.companyLogoUrl = payload.companyLogoUrl && payload.companyLogoUrl.length > 0 ? payload.companyLogoUrl : null

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                avatarUrl: true,
                preferredLanguage: true,
                notifyEmail: true,
                notifySms: true,
                notifyPush: true,
                twoFactorEnabled: true,
                dashboardCompact: true,
                companyName: true,
                companyLogoUrl: true,
                lastLoginAt: true,
                updatedAt: true,
            },
        })

        await createSystemLog({
            actor: user,
            action: 'USER_PROFILE_UPDATED',
            targetType: 'USER',
            targetId: user.id,
            details: `fields=${Object.keys(data).join(',')}`,
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Settings profile update error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
