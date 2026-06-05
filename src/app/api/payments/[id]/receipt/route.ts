import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { generatePaymentReceiptPdf } from '@/lib/pdf'
import {
  mapPaymentToReceiptWordData,
  renderReceiptWordDocument,
  templateExists,
} from '@/lib/word-documents'
import { canAccessContractScope } from '@/lib/rbac'
import { createSystemLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildReceiptNumber(paymentId: string, date: Date) {
  const suffix = paymentId.slice(-6).toUpperCase()
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `RCP-${stamp}-${suffix}`
}

const contractForReceiptSelect = {
  tenantId: true,
  contractNumber: true,
  contractType: true,
  startDate: true,
  endDate: true,
  rentAmount: true,
  depositAmount: true,
  contractText: true,
  rentalTermsSnapshot: true,
  receiptText: true,
  receiptFileUrl: true,
  ownerBirthDate: true,
  ownerBirthPlace: true,
  ownerNationality: true,
  ownerProfession: true,
  ownerIdDocumentNumber: true,
  ownerAddress: true,
  tenantBirthDate: true,
  tenantBirthPlace: true,
  tenantNationality: true,
  tenantProfession: true,
  tenantIdDocumentNumber: true,
  tenantAddress: true,
  propertyRoomCount: true,
  propertySurfaceSqm: true,
  propertyFloor: true,
  tenant: {
    select: { id: true, name: true, email: true, phone: true },
  },
  property: {
    select: {
      title: true,
      address: true,
      city: true,
      propertyType: true,
      roomCount: true,
      surfaceSqm: true,
      floor: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          paymentMomoNumber: true,
        },
      },
    },
  },
} as const

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
          select: contractForReceiptSelect,
        },
        installment: {
          select: { sequence: true },
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

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')?.toLowerCase()

    let receiptNumber = payment.receiptNumber
    const emissionDate = payment.receiptIssuedAt ?? new Date()

    if (!receiptNumber) {
      const now = new Date()
      receiptNumber = buildReceiptNumber(payment.id, now)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { receiptNumber, receiptIssuedAt: now },
      })
    }

    if (format === 'docx' && (await templateExists('quittance-loyer.docx'))) {
      const receiptData = mapPaymentToReceiptWordData(
        {
          ...payment,
          installmentSequence: payment.installment?.sequence ?? null,
        },
        payment.contract,
        receiptNumber,
        emissionDate
      )

      const docxBytes = await renderReceiptWordDocument(receiptData)

      await createSystemLog({
        actor: user,
        action: 'PAYMENT_RECEIPT_DOWNLOADED',
        targetType: 'PAYMENT',
        targetId: payment.id,
        details: `receiptNumber=${receiptNumber};format=docx`,
      })

      return new NextResponse(Buffer.from(docxBytes), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="quittance-${receiptNumber}.docx"`,
        },
      })
    }

    if (payment.contract.receiptFileUrl) {
      return NextResponse.redirect(payment.contract.receiptFileUrl, 302)
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
      contractNumber: payment.contract.contractNumber,
      receiptText: payment.contract.receiptText,
    })

    await createSystemLog({
      actor: user,
      action: 'PAYMENT_RECEIPT_DOWNLOADED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      details: `receiptNumber=${receiptNumber};format=pdf`,
    })

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quittance-${receiptNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Receipt generation error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
