import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { canAccessContractScope } from '@/lib/rbac'
import {
  computeFirstInstallmentAmounts,
  firstInstallmentLabel,
  RENT_ADVANCE_MONTHS_ON_ENTRY,
} from '@/lib/rental-first-payment'
import { syncFirstRentalInstallment } from '@/lib/sync-first-installment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADVANCE_INSTALLMENT_HORIZON_MONTHS = 6

function toUtcDayStart(value: Date): Date {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addUtcMonths(value: Date, months: number): Date {
  const date = new Date(value)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date
}

function getDaysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function resolveDueDateForMonth(anchorStartDate: Date, targetMonthDate: Date): Date {
  const year = targetMonthDate.getUTCFullYear()
  const monthIndex = targetMonthDate.getUTCMonth()
  const anchorDay = anchorStartDate.getUTCDate()
  const monthLastDay = getDaysInUtcMonth(year, monthIndex)
  const day = Math.min(anchorDay, monthLastDay)
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function monthDistance(startDate: Date, targetDate: Date): number {
  const yearDelta = targetDate.getUTCFullYear() - startDate.getUTCFullYear()
  const monthDelta = targetDate.getUTCMonth() - startDate.getUTCMonth()
  return yearDelta * 12 + monthDelta
}

async function ensureAdvanceInstallments(input: {
  contractId: string
  contractType: string
  status: string
  startDate: Date
  endDate: Date
  rentAmount: number
  depositAmount: number
}) {
  if (input.contractType !== 'RENTAL' || input.status !== 'ACTIVE') return

  const start = toUtcDayStart(input.startDate)
  const end = toUtcDayStart(input.endDate)
  if (start > end) return

  const today = toUtcDayStart(new Date())
  const horizon = addUtcMonths(today, ADVANCE_INSTALLMENT_HORIZON_MONTHS)
  const target = horizon < end ? horizon : end
  if (target < start) return

  const maxSequence = monthDistance(start, target) + 1
  if (maxSequence < 1) return

  const existing = await prisma.contractInstallment.findMany({
    where: { contractId: input.contractId },
    select: { sequence: true },
  })
  const existingSet = new Set(existing.map((item) => item.sequence))

  const rows: Array<{
    contractId: string
    sequence: number
    dueDate: Date
    baseAmount: number
    penaltyAmount: number
    totalDue: number
    status: 'OPEN'
  }> = []

  for (let sequence = 1; sequence <= maxSequence; sequence += 1) {
    if (existingSet.has(sequence)) continue

    const dueDate = resolveDueDateForMonth(start, addUtcMonths(start, sequence - 1))
    if (dueDate < start || dueDate > end) continue

    const amounts =
      sequence === 1
        ? computeFirstInstallmentAmounts(input.rentAmount, input.depositAmount)
        : {
            baseAmount: input.rentAmount,
            totalDue: input.rentAmount,
          }

    rows.push({
      contractId: input.contractId,
      sequence,
      dueDate,
      baseAmount: amounts.baseAmount,
      penaltyAmount: 0,
      totalDue: amounts.totalDue,
      status: 'OPEN',
    })
  }

  if (rows.length > 0) {
    for (const row of rows) {
      await prisma.contractInstallment.create({ data: row })
    }
  }
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
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        contractType: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        depositAmount: true,
        property: {
          select: {
            managerId: true,
            manager: {
              select: {
                paymentCollectionMode: true,
                paymentMomoNumber: true,
                paymentMomoProvider: true,
                paymentCardLink: true,
                paymentInstructions: true,
              },
            },
          },
        },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (!canAccessContractScope(user, contract)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureAdvanceInstallments({
      contractId: contract.id,
      contractType: contract.contractType,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      rentAmount: contract.rentAmount,
      depositAmount: contract.depositAmount,
    })

    await syncFirstRentalInstallment(contract.id)

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

    const installmentIds = installments.map((item) => item.id)
    const pendingPayments =
      installmentIds.length > 0
        ? await prisma.payment.findMany({
            where: {
              contractId: contract.id,
              status: 'PENDING',
              installmentId: { in: installmentIds },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              installmentId: true,
              amount: true,
              transactionId: true,
              status: true,
            },
          })
        : []

    const pendingByInstallmentId = new Map(
      pendingPayments
        .filter((item) => item.installmentId)
        .map((item) => [item.installmentId as string, item])
    )

    const firstPaymentRule = {
      label: firstInstallmentLabel(),
      advanceMonths: RENT_ADVANCE_MONTHS_ON_ENTRY,
      depositAmount: contract.depositAmount,
      advanceRent: contract.rentAmount * RENT_ADVANCE_MONTHS_ON_ENTRY,
      totalDue: computeFirstInstallmentAmounts(contract.rentAmount, contract.depositAmount).totalDue,
    }

    const uniqueInstallments = Array.from(
      new Map(installments.map((item) => [item.id, item])).values()
    )

    return NextResponse.json({
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      rentAmount: contract.rentAmount,
      depositAmount: contract.depositAmount,
      firstPaymentRule,
      paymentCollection: {
        mode: contract.property.manager?.paymentCollectionMode ?? 'DIRECT',
        momoNumber: contract.property.manager?.paymentMomoNumber ?? null,
        momoProvider: contract.property.manager?.paymentMomoProvider ?? null,
        cardLink: contract.property.manager?.paymentCardLink ?? null,
        instructions: contract.property.manager?.paymentInstructions ?? null,
      },
      installments: uniqueInstallments.map((item) => {
        const pending = pendingByInstallmentId.get(item.id)
        return {
          id: item.id,
          sequence: item.sequence,
          dueDate: item.dueDate.toISOString(),
          status: item.status,
          baseAmount: Number(item.baseAmount),
          penaltyAmount: Number(item.penaltyAmount),
          totalDue: Number(item.totalDue),
          label: item.sequence === 1 ? firstInstallmentLabel() : `Loyer mensuel #${item.sequence}`,
          pendingPayment: pending
            ? {
                id: pending.id,
                amount: Number(pending.amount),
                transactionId: pending.transactionId,
                status: pending.status,
              }
            : null,
        }
      }),
    })
  } catch (error) {
    console.error('Contract installments fetch error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
