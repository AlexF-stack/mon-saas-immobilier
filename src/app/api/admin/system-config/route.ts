import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { createSystemLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const configKeySchema = z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Z0-9_]+$/)

const configItemSchema = z
    .object({
        key: configKeySchema,
        value: z.string().trim().min(1).max(6000),
        description: z.string().trim().max(200).nullable().optional(),
    })
    .strict()

const systemConfigUpdateSchema = z
    .object({
        settings: z.array(configItemSchema).min(1).max(50),
    })
    .strict()

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const settings = await prisma.systemConfig.findMany({
            orderBy: { key: 'asc' },
            select: {
                id: true,
                key: true,
                value: true,
                description: true,
                updatedById: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        return NextResponse.json(settings)
    } catch (error) {
        console.error('System config fetch error', error)
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
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const payload = systemConfigUpdateSchema.parse(await request.json())

        await prisma.$transaction(
            payload.settings.map((setting) =>
                prisma.systemConfig.upsert({
                    where: { key: setting.key },
                    update: {
                        value: setting.value,
                        description: setting.description ?? null,
                        updatedById: user.id,
                    },
                    create: {
                        key: setting.key,
                        value: setting.value,
                        description: setting.description ?? null,
                        updatedById: user.id,
                    },
                    select: { id: true },
                })
            )
        )

        await createSystemLog({
            actor: user,
            action: 'SYSTEM_CONFIG_UPDATED',
            targetType: 'SYSTEM',
            details: `keys=${payload.settings.map((setting) => setting.key).join(',')}`,
        })

        const settings = await prisma.systemConfig.findMany({
            orderBy: { key: 'asc' },
            select: {
                id: true,
                key: true,
                value: true,
                description: true,
                updatedById: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        return NextResponse.json(settings)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('System config update error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
