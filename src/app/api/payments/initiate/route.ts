import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requestPayment } from '@/lib/payment'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const initiatePaymentSchema = z.object({
    contractId: z.string().trim().min(1),
    amount: z.coerce.number().positive(),
    phoneNumber: z.string().trim().min(8).max(20),
    provider: z.enum(['MTN', 'MOOV']),
})

const idempotencyKeySchema = z
    .string()
    .trim()
    .min(12)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/)

function amountsMatch(expected: number, provided: number) {
    return Math.abs(expected - provided) < 0.01
}

export async function POST(request: Request) {
    try {
        const csrfError = enforceCsrf(request)
        if (csrfError) return csrfError

        const token = getTokenFromRequest(request)
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await verifyAuth(token)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const idempotencyHeader = request.headers.get('x-idempotency-key')
        const parsedIdempotencyKey = idempotencyKeySchema.safeParse(idempotencyHeader ?? '')
        if (!parsedIdempotencyKey.success) {
            return NextResponse.json(
                { error: 'Missing or invalid x-idempotency-key header' },
                { status: 400 }
            )
        }
        const idempotencyKey = parsedIdempotencyKey.data

        const existingByIdempotency = await prisma.payment.findUnique({
            where: { idempotencyKey },
            select: {
                id: true,
                transactionId: true,
                status: true,
                initiatedById: true,
            },
        })

        if (existingByIdempotency) {
            if (existingByIdempotency.initiatedById !== user.id) {
                await createSystemLog({
                    actor: user,
                    action: 'PAYMENT_INITIATION_DUPLICATE_KEY_REJECTED',
                    targetType: 'PAYMENT',
                    targetId: existingByIdempotency.id,
                    details: `idempotencyKey=${idempotencyKey}`,
                })
                return NextResponse.json(
                    { error: 'Idempotency key conflict' },
                    { status: 409 }
                )
            }

            await createSystemLog({
                actor: user,
                action: 'PAYMENT_INITIATION_REPLAYED',
                targetType: 'PAYMENT',
                targetId: existingByIdempotency.id,
                details: `idempotencyKey=${idempotencyKey};status=${existingByIdempotency.status}`,
            })

            return NextResponse.json({
                paymentId: existingByIdempotency.id,
                transactionId: existingByIdempotency.transactionId,
                status: existingByIdempotency.status,
                idempotent: true,
                message: 'Payment request already processed.',
            })
        }

        const body = await request.json()
        const payload = initiatePaymentSchema.parse(body)

        const contract = await prisma.contract.findUnique({
            where: { id: payload.contractId },
            select: {
                id: true,
                tenantId: true,
                status: true,
                rentAmount: true,
                property: {
                    select: {
                        id: true,
                        managerId: true,
                    },
                },
            },
        })

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
        }

        const isAllowed =
            user.role === 'ADMIN' ||
            (user.role === 'MANAGER' && contract.property.managerId === user.id) ||
            (user.role === 'TENANT' && contract.tenantId === user.id)

        if (!isAllowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (contract.status !== 'ACTIVE') {
            await createSystemLog({
                actor: user,
                action: 'PAYMENT_INITIATION_BLOCKED',
                targetType: 'CONTRACT',
                targetId: contract.id,
                details: `reason=contract_not_active;status=${contract.status};idempotencyKey=${idempotencyKey}`,
            })
            return NextResponse.json(
                { error: 'Contract is not active for payment.' },
                { status: 409 }
            )
        }

        if (!amountsMatch(contract.rentAmount, payload.amount)) {
            await createSystemLog({
                actor: user,
                action: 'PAYMENT_INITIATION_BLOCKED',
                targetType: 'CONTRACT',
                targetId: contract.id,
                details: `reason=amount_mismatch;expected=${contract.rentAmount};received=${payload.amount};idempotencyKey=${idempotencyKey}`,
            })
            return NextResponse.json(
                { error: 'Invalid amount for this contract.' },
                { status: 400 }
            )
        }

        const paymentResponse = await requestPayment({
            amount: payload.amount,
            phoneNumber: payload.phoneNumber,
            provider: payload.provider,
            contractId: payload.contractId,
        })

        if (paymentResponse.status === 'FAILED') {
            await createSystemLog({
                actor: user,
                action: 'PAYMENT_INITIATION_PROVIDER_FAILED',
                targetType: 'CONTRACT',
                targetId: payload.contractId,
                details: `provider=${payload.provider};message=${paymentResponse.message};idempotencyKey=${idempotencyKey}`,
            })
            return NextResponse.json({ error: paymentResponse.message }, { status: 400 })
        }

        let payment
        try {
            payment = await prisma.payment.create({
                data: {
                    amount: payload.amount,
                    method: payload.provider,
                    transactionId: paymentResponse.transactionId,
                    idempotencyKey,
                    status: 'PENDING',
                    contractId: payload.contractId,
                    tenantId: contract.tenantId,
                    propertyId: contract.property.id,
                    initiatedById: user.id,
                    initiatedByRole: user.role,
                },
            })
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const duplicated = await prisma.payment.findUnique({
                    where: { idempotencyKey },
                    select: {
                        id: true,
                        transactionId: true,
                        status: true,
                        initiatedById: true,
                    },
                })

                if (duplicated && duplicated.initiatedById === user.id) {
                    return NextResponse.json({
                        paymentId: duplicated.id,
                        transactionId: duplicated.transactionId,
                        status: duplicated.status,
                        idempotent: true,
                        message: 'Payment request already processed.',
                    })
                }
            }
            throw error
        }

        await createSystemLog({
            actor: user,
            action: 'PAYMENT_INITIATED',
            targetType: 'PAYMENT',
            targetId: payment.id,
            details: `contractId=${payload.contractId};tenantId=${contract.tenantId};propertyId=${contract.property.id};amount=${payload.amount};provider=${payload.provider};idempotencyKey=${idempotencyKey}`,
        })

        return NextResponse.json({
            paymentId: payment.id,
            transactionId: payment.transactionId,
            status: payment.status,
            idempotent: false,
            message: paymentResponse.message,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Payment initiation error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
