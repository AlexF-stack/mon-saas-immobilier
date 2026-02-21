import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { enforceCsrf } from '@/lib/csrf'
import { captureServerError } from '@/lib/monitoring'
import { getClientIpFromHeaders } from '@/lib/request-metadata'
import { createFinancialAuditLog } from '@/lib/financial-audit'
import { getLogContextFromRequest, logServerEvent } from '@/lib/logger'
import {
  canTransitionWithdrawalStatus,
  getLatestWithdrawalRecords,
  isWithdrawalStatus,
  WITHDRAWAL_ACTION,
  WITHDRAWAL_TARGET_TYPE,
} from '@/lib/withdrawals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateStatusSchema = z.object({
  status: z.enum(['APPROVED', 'PAID', 'REJECTED']),
  note: z.string().trim().max(400).optional(),
})

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ withdrawalId: string }> }
) {
  try {
    const { correlationId, route } = getLogContextFromRequest(request)
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

    logServerEvent({
      event: 'withdraw.status.update.requested',
      correlationId,
      route,
      userId: user.id,
    })

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { withdrawalId } = await props.params
    const payload = updateStatusSchema.parse(await request.json())
    const ipAddress = getClientIpFromHeaders(request.headers) ?? 'unknown'
    const userAgent = request.headers.get('user-agent')?.slice(0, 180) ?? 'unknown'

    let updatedStatus: string | null = null
    let attempt = 0
    while (attempt < 3) {
      attempt += 1
      try {
        updatedStatus = await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`withdraw:${withdrawalId}`}))`

            const logs = await tx.systemLog.findMany({
              where: {
                targetType: WITHDRAWAL_TARGET_TYPE,
                action: WITHDRAWAL_ACTION,
                targetId: withdrawalId,
              },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                actorId: true,
                actorEmail: true,
                actorRole: true,
                targetId: true,
                details: true,
                createdAt: true,
              },
            })

            const latest = getLatestWithdrawalRecords(logs).find((record) => record.withdrawalId === withdrawalId)
            if (!latest) {
              throw new Error('WITHDRAWAL_NOT_FOUND')
            }

            if (!isWithdrawalStatus(latest.status)) {
              throw new Error('WITHDRAWAL_INVALID_STATUS')
            }

            if (!canTransitionWithdrawalStatus(latest.status, payload.status)) {
              throw new Error('WITHDRAWAL_INVALID_TRANSITION')
            }

            const details = JSON.stringify({
              status: payload.status,
              amount: latest.amount,
              method: latest.method,
              accountLabel: latest.accountLabel,
              accountNumberMasked: latest.accountNumberMasked,
              note: payload.note?.trim() || latest.note || undefined,
              availableBefore: 0,
              availableAfter: 0,
              correlationId,
              ip: ipAddress,
              userAgent,
              reviewedById: user.id,
              reviewedByEmail: user.email,
              reviewedByRole: user.role,
            })

            await tx.systemLog.create({
              data: {
                actorId: latest.actorId,
                actorEmail: latest.actorEmail,
                actorRole: latest.actorRole,
                action: WITHDRAWAL_ACTION,
                targetType: WITHDRAWAL_TARGET_TYPE,
                targetId: withdrawalId,
                details,
              },
            })

            await createFinancialAuditLog(tx, {
              type: 'WITHDRAWAL',
              entityId: withdrawalId,
              fromStatus: latest.status,
              toStatus: payload.status,
              actorId: user.id,
              correlationId,
              metadata: {
                reviewedById: user.id,
                reviewedByRole: user.role,
              },
            })

            return payload.status
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        )

        break
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'WITHDRAWAL_NOT_FOUND') {
            return NextResponse.json({ error: 'Withdrawal request not found.' }, { status: 404 })
          }
          if (error.message === 'WITHDRAWAL_INVALID_TRANSITION') {
            return NextResponse.json(
              { error: 'Invalid status transition for this withdrawal.' },
              { status: 409 }
            )
          }
        }

        if (isRetryableTransactionError(error) && attempt < 3) {
          continue
        }
        throw error
      }
    }

    if (!updatedStatus) {
      return NextResponse.json({ error: 'Unable to update withdrawal status.' }, { status: 500 })
    }

    logServerEvent({
      event: 'withdraw.status.updated',
      correlationId,
      route,
      userId: user.id,
      details: {
        withdrawalId,
        status: updatedStatus,
      },
    })

    return NextResponse.json({ status: updatedStatus })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }

    const fallbackContext = getLogContextFromRequest(request)
    await captureServerError(error, {
      scope: 'withdrawal_status_update',
      targetType: 'WITHDRAWAL',
      correlationId: fallbackContext.correlationId,
      route: fallbackContext.route,
      event: 'withdraw.status.update.failed',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
