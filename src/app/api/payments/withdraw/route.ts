import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { enforceRateLimit } from '@/lib/security-rate-limit'
import { captureServerError } from '@/lib/monitoring'
import { getClientIpFromHeaders } from '@/lib/request-metadata'
import {
  getLatestWithdrawalRecords,
  maskAccountNumber,
  parseWithdrawalDetails,
  sumReservedWithdrawals,
  WITHDRAWAL_ACTION,
  WITHDRAWAL_TARGET_TYPE,
} from '@/lib/withdrawals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WITHDRAW_RATE_LIMIT = 8
const WITHDRAW_WINDOW_MS = 10 * 60 * 1000
const WITHDRAW_MAX_SINGLE_AMOUNT = Number(process.env.WITHDRAWAL_MAX_SINGLE_AMOUNT ?? 2_000_000)
const WITHDRAW_MAX_DAILY_AMOUNT = Number(process.env.WITHDRAWAL_MAX_DAILY_AMOUNT ?? 5_000_000)
const WITHDRAW_MAX_DAILY_COUNT = Number(process.env.WITHDRAWAL_MAX_DAILY_COUNT ?? 3)
const MAX_RETRY_SERIALIZABLE = 3

const withdrawSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  method: z.enum(['MOMO', 'BANK', 'CASHOUT']),
  accountLabel: z.string().trim().min(3).max(80),
  accountNumber: z.string().trim().min(4).max(64),
  note: z.string().trim().max(400).optional(),
})

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

function dayStartUtc(): Date {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  return start
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

    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimitError = await enforceRateLimit({
      request,
      bucket: 'PAYMENT_WITHDRAW',
      limit: WITHDRAW_RATE_LIMIT,
      windowMs: WITHDRAW_WINDOW_MS,
      actor: user,
      extraKey: user.id,
      message: 'Too many withdrawal attempts. Please retry later.',
    })
    if (rateLimitError) {
      return rateLimitError
    }

    const body = await request.json()
    const payload = withdrawSchema.parse(body)

    if (payload.amount > WITHDRAW_MAX_SINGLE_AMOUNT) {
      return NextResponse.json(
        { error: `Montant maximum par retrait: ${WITHDRAW_MAX_SINGLE_AMOUNT.toLocaleString('fr-FR')} FCFA.` },
        { status: 409 }
      )
    }

    const ipAddress = getClientIpFromHeaders(request.headers) ?? 'unknown'
    const userAgent = request.headers.get('user-agent')?.slice(0, 180) ?? 'unknown'
    const todayStart = dayStartUtc()

    let result:
      | {
          id: string
          availableBalanceAfter: number
        }
      | null = null

    for (let attempt = 1; attempt <= MAX_RETRY_SERIALIZABLE; attempt += 1) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`withdraw:${user.id}`}))`

            const revenueWhere =
              user.role === 'ADMIN'
                ? { status: 'COMPLETED' as const }
                : {
                    status: 'COMPLETED' as const,
                    contract: {
                      property: {
                        managerId: user.id,
                      },
                    },
                  }

            const [completedRevenue, allWithdrawalLogs] = await Promise.all([
              tx.payment.aggregate({
                where: revenueWhere,
                _sum: { amount: true },
              }),
              tx.systemLog.findMany({
                where: {
                  actorId: user.id,
                  action: WITHDRAWAL_ACTION,
                  targetType: WITHDRAWAL_TARGET_TYPE,
                },
                select: {
                  id: true,
                  actorId: true,
                  actorEmail: true,
                  actorRole: true,
                  targetId: true,
                  details: true,
                  createdAt: true,
                },
              }),
            ])

            const totalRevenue = Number(completedRevenue._sum.amount ?? 0)
            const withdrawalRecords = getLatestWithdrawalRecords(allWithdrawalLogs)
            const reservedTotal = sumReservedWithdrawals(withdrawalRecords)
            const availableBalance = roundMoney(Math.max(0, totalRevenue - reservedTotal))

            if (payload.amount > availableBalance) {
              throw new Error('INSUFFICIENT_AVAILABLE_BALANCE')
            }

            const dailyRequestedEvents = allWithdrawalLogs
              .map((log) => ({
                createdAt: log.createdAt,
                parsed: parseWithdrawalDetails(log.details),
              }))
              .filter(
                (event): event is { createdAt: Date; parsed: NonNullable<typeof event.parsed> } =>
                  event.parsed !== null &&
                  event.parsed.status === 'REQUESTED' &&
                  event.createdAt >= todayStart
              )

            const dailyRequestedCount = dailyRequestedEvents.length
            const dailyRequestedAmount = dailyRequestedEvents.reduce(
              (sum, event) => sum + event.parsed.amount,
              0
            )

            if (dailyRequestedCount >= WITHDRAW_MAX_DAILY_COUNT) {
              throw new Error('DAILY_WITHDRAW_COUNT_LIMIT')
            }

            if (dailyRequestedAmount + payload.amount > WITHDRAW_MAX_DAILY_AMOUNT) {
              throw new Error('DAILY_WITHDRAW_AMOUNT_LIMIT')
            }

            const nextAvailableBalance = roundMoney(availableBalance - payload.amount)
            const withdrawalId = randomUUID()
            const withdrawalDetails = JSON.stringify({
              status: 'REQUESTED',
              amount: payload.amount,
              method: payload.method,
              accountLabel: payload.accountLabel,
              accountNumberMasked: maskAccountNumber(payload.accountNumber),
              note: payload.note?.trim() || undefined,
              availableBefore: availableBalance,
              availableAfter: nextAvailableBalance,
              ip: ipAddress,
              userAgent,
            })

            await tx.systemLog.create({
              data: {
                actorId: user.id,
                actorEmail: user.email,
                actorRole: user.role,
                action: WITHDRAWAL_ACTION,
                targetType: WITHDRAWAL_TARGET_TYPE,
                targetId: withdrawalId,
                details: withdrawalDetails,
              },
            })

            return {
              id: withdrawalId,
              availableBalanceAfter: nextAvailableBalance,
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        )

        break
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'INSUFFICIENT_AVAILABLE_BALANCE') {
            return NextResponse.json(
              { error: 'Montant superieur au solde disponible.' },
              { status: 409 }
            )
          }
          if (error.message === 'DAILY_WITHDRAW_COUNT_LIMIT') {
            return NextResponse.json(
              { error: `Limite journaliere atteinte (${WITHDRAW_MAX_DAILY_COUNT} retraits).` },
              { status: 409 }
            )
          }
          if (error.message === 'DAILY_WITHDRAW_AMOUNT_LIMIT') {
            return NextResponse.json(
              { error: `Plafond journalier atteint (${WITHDRAW_MAX_DAILY_AMOUNT.toLocaleString('fr-FR')} FCFA).` },
              { status: 409 }
            )
          }
        }

        if (isRetryableTransactionError(error) && attempt < MAX_RETRY_SERIALIZABLE) {
          continue
        }

        throw error
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'Unable to create withdrawal request.' }, { status: 500 })
    }

    return NextResponse.json(
      {
        id: result.id,
        status: 'REQUESTED',
        availableBalanceAfter: result.availableBalanceAfter,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }

    await captureServerError(error, {
      scope: 'payment_withdraw',
      targetType: 'WITHDRAWAL',
    })

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
