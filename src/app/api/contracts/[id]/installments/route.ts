import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
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
          select: { managerId: true },
        },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (!canAccessContractScope(user, contract)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const installments = await prisma.contractInstallment.findMany({
      where: {
        contractId: contract.id,
        status: { in: ['OPEN', 'OVERDUE'] },
        paidAt: null,
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
      select: {
        id: true,
        sequence: true,
        dueDate: true,
        baseAmount: true,
        penaltyAmount: true,
        totalDue: true,
        status: true,
      },
    })

    return NextResponse.json({
      contractId: contract.id,
      contractType: contract.contractType,
      rentAmount: contract.rentAmount,
      installments: installments.map((item) => ({
        id: item.id,
        sequence: item.sequence,
        dueDate: item.dueDate.toISOString(),
        status: item.status,
        baseAmount: Number(item.baseAmount),
        penaltyAmount: Number(item.penaltyAmount),
        totalDue: Number(item.totalDue),
      })),
    })
  } catch (error) {
    console.error('Contract installments fetch error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
