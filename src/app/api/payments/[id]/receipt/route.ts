import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { generatePaymentReceiptPdf } from '@/lib/pdf'
import { canAccessContractScope } from '@/lib/rbac'
import { createSystemLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


function buildReceiptNumber(paymentId: string, date: Date) {
    const suffix = paymentId.slice(-6).toUpperCase()
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    return `RCP-${stamp}-${suffix}`
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = getTokenFromRequest(request)
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await verifyAuth(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                contract: {
                    include: {
                        tenant: {
                            select: { id: true, name: true, email: true },
                        },
                        property: {
                            include: {
                                manager: {
                                    select: { id: true, name: true, email: true },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
        }

        if (!canAccessContractScope(user, payment.contract)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (payment.status !== 'COMPLETED') {
            return NextResponse.json(
                { error: 'Receipt is available only for completed payments' },
                { status: 400 }
            )
        }

        let receiptNumber = payment.receiptNumber

        if (!receiptNumber) {
            const now = new Date()
            receiptNumber = buildReceiptNumber(payment.id, now)
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    receiptNumber,
                    receiptIssuedAt: now,
                },
            })
        }

        const ownerDisplayName =
            payment.contract.property.manager?.name ||
            payment.contract.property.manager?.email ||
            'Proprietaire'

        const tenantDisplayName = payment.contract.tenant.name || payment.contract.tenant.email
        const pdfBytes = await generatePaymentReceiptPdf({
            receiptNumber,
            tenantName: tenantDisplayName,
            ownerName: ownerDisplayName,
            propertyTitle: payment.contract.property.title,
            propertyAddress: payment.contract.property.address,
            paymentDate: payment.updatedAt,
            amount: payment.amount,
            method: payment.method,
            transactionId: payment.transactionId ?? payment.id,
        })

        await createSystemLog({
            actor: user,
            action: 'PAYMENT_RECEIPT_DOWNLOADED',
            targetType: 'PAYMENT',
            targetId: payment.id,
            details: `receiptNumber=${receiptNumber}`,
        })

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=\"quittance-${receiptNumber}.pdf\"`,
            },
        })
    } catch (error) {
        console.error('Receipt generation error', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
