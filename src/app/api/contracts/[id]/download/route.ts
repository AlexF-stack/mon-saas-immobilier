import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContractPdf } from '@/lib/pdf'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canAccessContractScope } from '@/lib/rbac'

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
                property: true,
                tenant: true,
            },
        })

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
        }

        if (!canAccessContractScope(user, contract)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const pdfBytes = await generateContractPdf({
            ownerName: 'Agence Immo SaaS',
            tenantName: contract.tenant.name || contract.tenant.email,
            propertyAddress: contract.property.address,
            startDate: contract.startDate,
            endDate: contract.endDate,
            rentAmount: contract.rentAmount,
            depositAmount: contract.depositAmount,
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
