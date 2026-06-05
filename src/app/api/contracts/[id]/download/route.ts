import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContractPdf } from '@/lib/pdf'
import {
  mapContractRecordToWordData,
  renderContractWordDocument,
  templateExists,
} from '@/lib/word-documents'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canAccessContractScope } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


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

        const contract = await prisma.contract.findUnique({
            where: { id },
            include: {
                property: {
                    include: {
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
                tenant: true,
            },
        })

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
        }

        if (!canAccessContractScope(user, contract)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format')?.toLowerCase()

        if (format === 'docx') {
            const templateName =
                contract.contractType === 'SALE' ? 'contrat-vente.docx' : 'contrat-location.docx'
            if (!(await templateExists(templateName))) {
                return NextResponse.json({ error: 'Modele Word indisponible' }, { status: 503 })
            }

            const docxBytes = await renderContractWordDocument(mapContractRecordToWordData(contract))
            return new NextResponse(Buffer.from(docxBytes), {
                headers: {
                    'Content-Type':
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="contrat-${contract.contractNumber}.docx"`,
                },
                status: 200,
            })
        }

        if (contract.fileUrl) {
            return NextResponse.redirect(contract.fileUrl, 302)
        }

        const pdfBytes = await generateContractPdf({
            ownerName: contract.property.manager?.name || contract.property.manager?.email || 'Agence Immo SaaS',
            ownerEmail: contract.property.manager?.email || null,
            tenantName: contract.tenant.name || contract.tenant.email,
            tenantEmail: contract.tenant.email || null,
            tenantPhone: contract.tenant.phone || null,
            propertyTitle: contract.property.title,
            propertyAddress: contract.property.address,
            propertyCity: contract.property.city,
            propertyType: contract.property.propertyType,
            startDate: contract.startDate,
            endDate: contract.endDate,
            rentAmount: contract.rentAmount,
            depositAmount: contract.depositAmount,
            contractType: contract.contractType === 'SALE' ? 'SALE' : 'RENTAL',
            contractNumber: contract.contractNumber,
            contractText: contract.contractText,
            ownerSignedAt: contract.ownerSignedAt,
            tenantSignedAt: contract.tenantSignedAt,
        })

        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="contrat-${contract.id}.pdf"`,
            },
            status: 200,
        })
    } catch (error) {
        console.error('PDF Generation Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
