import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/payment'

function buildReceiptNumber(paymentId: string, date: Date) {
    const suffix = paymentId.slice(-6).toUpperCase()
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    return `RCP-${stamp}-${suffix}`
}

const webhookPayloadSchema = z
    .object({
        transactionId: z.string().trim().min(1),
        status: z.string().trim().min(1),
        amount: z.coerce.number().positive().optional(),
        contractId: z.string().trim().min(1).optional(),
    })
    .passthrough()

function amountsMatch(expected: number, provided: number) {
    return Math.abs(expected - provided) < 0.01
}

function getWebhookSecret() {
    const configured = process.env.MOMO_WEBHOOK_SECRET?.trim()
    if (configured) return configured
    if (process.env.NODE_ENV === 'production') return null
    return 'momo-dev-secret'
}

export async function POST(request: Request) {
    try {
        const signature = request.headers.get('X-Callback-Signature')
        const bodyText = await request.text()
        const webhookSecret = getWebhookSecret()

        if (!webhookSecret) {
            console.error('MOMO_WEBHOOK_SECRET is missing in production environment')
            return NextResponse.json(
                { error: 'Webhook secret is not configured' },
                { status: 500 }
            )
        }

        if (!signature || !verifyWebhookSignature(signature, bodyText, webhookSecret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const parsedPayload = webhookPayloadSchema.safeParse(JSON.parse(bodyText))
        if (!parsedPayload.success) {
            return NextResponse.json({ error: parsedPayload.error.issues }, { status: 400 })
        }

        const payload = parsedPayload.data

        const processed = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { transactionId: payload.transactionId },
                include: {
                    contract: {
                        include: {
                            property: {
                                select: {
                                    id: true,
                                    title: true,
                                    managerId: true,
                                },
                            },
                            tenant: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            })

            if (!payment) {
                return { type: 'not_found' as const }
            }

            if (payment.status === 'COMPLETED' || payment.status === 'FAILED') {
                return {
                    type: 'already_processed' as const,
                    paymentId: payment.id,
                    paymentStatus: payment.status,
                    receiptNumber: payment.receiptNumber,
                }
            }

            const providerSuccessful =
                payload.status === 'SUCCESSFUL' || payload.status === 'COMPLETED'
            const amountMatchesProvider =
                payload.amount !== undefined && amountsMatch(payment.amount, payload.amount)
            const contractMatchesProvider =
                payload.contractId !== undefined && payload.contractId === payment.contractId
            const secureMatch = amountMatchesProvider && contractMatchesProvider
            const isSuccessful = providerSuccessful && secureMatch
            const now = new Date()

            const updateData: {
                status: string
                updatedAt: Date
                receiptNumber?: string
                receiptIssuedAt?: Date
                ownerNotifiedAt?: Date
            } = {
                status: isSuccessful ? 'COMPLETED' : 'FAILED',
                updatedAt: now,
            }

            if (isSuccessful && !payment.receiptNumber) {
                updateData.receiptNumber = buildReceiptNumber(payment.id, now)
                updateData.receiptIssuedAt = now
            }

            const shouldNotifyOwner =
                isSuccessful &&
                payment.initiatedByRole === 'TENANT' &&
                !!payment.contract.property.managerId

            if (shouldNotifyOwner) {
                updateData.ownerNotifiedAt = now
            }

            const updatedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: updateData,
                select: {
                    id: true,
                    status: true,
                    receiptNumber: true,
                    ownerNotifiedAt: true,
                },
            })

            const mismatchReason =
                providerSuccessful && !secureMatch
                    ? `amountMatches=${amountMatchesProvider};contractMatches=${contractMatchesProvider};payloadAmount=${payload.amount ?? 'none'};payloadContractId=${payload.contractId ?? 'none'}`
                    : null

            await tx.systemLog.create({
                data: {
                    action: mismatchReason ? 'PAYMENT_WEBHOOK_VALIDATION_FAILED' : isSuccessful ? 'PAYMENT_COMPLETED' : 'PAYMENT_FAILED',
                    targetType: 'PAYMENT',
                    targetId: payment.id,
                    details: `transactionId=${payload.transactionId};providerStatus=${payload.status}${mismatchReason ? `;${mismatchReason}` : ''}`,
                },
            })

            if (shouldNotifyOwner && payment.contract.property.managerId) {
                const tenantDisplayName = payment.contract.tenant.name || payment.contract.tenant.email
                await tx.notification.create({
                    data: {
                        userId: payment.contract.property.managerId,
                        type: 'PAYMENT_RECEIVED',
                        title: 'Paiement locataire recu',
                        message: `${tenantDisplayName} a regle ${payment.amount.toLocaleString('fr-FR')} FCFA pour ${payment.contract.property.title}.`,
                        paymentId: payment.id,
                    },
                })

                await tx.systemLog.create({
                    data: {
                        action: 'OWNER_NOTIFIED',
                        targetType: 'USER',
                        targetId: payment.contract.property.managerId,
                        details: `paymentId=${payment.id}`,
                    },
                })
            }

            return {
                type: 'updated' as const,
                paymentId: updatedPayment.id,
                paymentStatus: updatedPayment.status,
                receiptNumber: updatedPayment.receiptNumber,
            }
        })

        if (processed.type === 'not_found') {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
        }

        if (processed.type === 'already_processed') {
            return NextResponse.json({
                status: 'already_processed',
                paymentId: processed.paymentId,
                paymentStatus: processed.paymentStatus,
                receiptNumber: processed.receiptNumber,
            })
        }

        return NextResponse.json({
            status: 'received',
            paymentId: processed.paymentId,
            paymentStatus: processed.paymentStatus,
            receiptNumber: processed.receiptNumber,
        })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
