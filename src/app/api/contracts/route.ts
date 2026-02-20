import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const createContractSchema = z
    .object({
        propertyId: z.string().trim().min(1),
        tenantId: z.string().trim().min(1),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        rentAmount: z.coerce.number().positive(),
        depositAmount: z.coerce.number().min(0),
    })
    .refine((payload) => payload.endDate > payload.startDate, {
        message: 'endDate must be after startDate',
        path: ['endDate'],
    })

export async function GET(request: Request) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let whereClause = {}
        if (user.role === 'MANAGER') {
            whereClause = { property: { managerId: user.id } }
        } else if (user.role === 'TENANT') {
            whereClause = { tenantId: user.id }
        }

        const contracts = await prisma.contract.findMany({
            where: whereClause,
            include: {
                property: { select: { id: true, title: true, address: true, managerId: true, status: true } },
                tenant: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json(contracts)
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        // PROPRIETAIRE = role interne MANAGER
        if (!user || user.role !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })
        }

        const body = await request.json()
        const payload = createContractSchema.parse(body)
        const shouldForceRollback =
            (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_CONTRACT_ROLLBACK === '1') &&
            request.headers.get('x-test-force-contract-rollback') === '1'

        const [property, tenant, existingActiveContract] = await Promise.all([
            prisma.property.findUnique({
                where: { id: payload.propertyId },
                select: { id: true, managerId: true, status: true },
            }),
            prisma.user.findUnique({
                where: { id: payload.tenantId },
                select: { id: true, role: true, isSuspended: true },
            }),
            prisma.contract.findFirst({
                where: { propertyId: payload.propertyId, status: 'ACTIVE' },
                select: { id: true },
            }),
        ])

        if (!property) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }

        if (property.managerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: property not owned by requester' }, { status: 403 })
        }

        if (property.status === 'MAINTENANCE') {
            return NextResponse.json({ error: 'Property is in maintenance state' }, { status: 409 })
        }

        if (existingActiveContract) {
            return NextResponse.json({ error: 'Property already has an active contract' }, { status: 409 })
        }

        if (!tenant || tenant.role !== 'TENANT' || tenant.isSuspended) {
            return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
        }

        const contract = await prisma.$transaction(async (tx) => {
            const createdContract = await tx.contract.create({
                data: {
                    propertyId: payload.propertyId,
                    tenantId: payload.tenantId,
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    rentAmount: payload.rentAmount,
                    depositAmount: payload.depositAmount,
                    status: 'ACTIVE',
                },
            })

            if (shouldForceRollback) {
                throw new Error('FORCED_CONTRACT_ROLLBACK')
            }

            await tx.property.update({
                where: { id: payload.propertyId },
                data: { status: 'RENTED', isPublished: false, publishedAt: null },
            })

            return createdContract
        })

        await createSystemLog({
            actor: user,
            action: 'CONTRACT_CREATED',
            targetType: 'CONTRACT',
            targetId: contract.id,
            details: `propertyId=${payload.propertyId};tenantId=${payload.tenantId}`,
        })

        return NextResponse.json(contract, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        if (error instanceof Error && error.message === 'FORCED_CONTRACT_ROLLBACK') {
            return NextResponse.json({ error: 'Forced rollback for test' }, { status: 500 })
        }
        console.error(error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
