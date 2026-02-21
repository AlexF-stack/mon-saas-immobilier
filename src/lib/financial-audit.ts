import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

type FinancialAuditType = 'PAYMENT' | 'WITHDRAWAL'

type FinancialAuditPayload = {
  type: FinancialAuditType
  entityId: string
  fromStatus?: string | null
  toStatus: string
  actorId?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown>
}

type SqlClient = {
  $executeRaw: (
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ) => Promise<number>
}

export async function createFinancialAuditLog(
  client: SqlClient,
  payload: FinancialAuditPayload
) {
  const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null

  await client.$executeRaw`
    INSERT INTO "FinancialAuditLog"
      ("id", "type", "entityId", "fromStatus", "toStatus", "actorId", "correlationId", "metadata", "createdAt")
    VALUES
      (
        ${randomUUID()},
        ${payload.type},
        ${payload.entityId},
        ${payload.fromStatus ?? null},
        ${payload.toStatus},
        ${payload.actorId ?? null},
        ${payload.correlationId ?? null},
        ${metadata},
        NOW()
      )
  `
}
