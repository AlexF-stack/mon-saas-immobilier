import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { PaymentsTable } from '@/components/dashboard/PaymentsTable'
import { WithdrawPanel } from '@/components/dashboard/WithdrawPanel'
import {
  getLatestWithdrawalRecords,
  sumPaidWithdrawals,
  sumReservedWithdrawals,
  WITHDRAWAL_ACTION,
  WITHDRAWAL_TARGET_TYPE,
} from '@/lib/withdrawals'

export default async function PaymentsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const user = token ? await verifyAuth(token) : null

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const role = user.role
  const userId = user.id

  let whereClause = {}
  if (role === 'MANAGER') {
    whereClause = { contract: { property: { managerId: userId } } }
  } else if (role === 'TENANT') {
    whereClause = { contract: { tenantId: userId } }
  }

  const payments = await prisma.payment.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: { contract: { include: { property: true, tenant: true } } },
  })

  const totalRevenue = payments
    .filter((payment) => payment.status === 'COMPLETED')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const canCreatePayment = role === 'MANAGER' || role === 'TENANT'
  const canWithdraw = role === 'ADMIN' || role === 'MANAGER'

  const withdrawalLogs = canWithdraw
    ? await prisma.systemLog.findMany({
        where: {
          action: WITHDRAWAL_ACTION,
          targetType: WITHDRAWAL_TARGET_TYPE,
          ...(role === 'ADMIN' ? {} : { actorId: userId }),
        },
        orderBy: { createdAt: 'desc' },
        take: role === 'ADMIN' ? 400 : 120,
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
    : []

  const allWithdrawalRecords = getLatestWithdrawalRecords(withdrawalLogs)
  const ownWithdrawalRecords =
    role === 'ADMIN'
      ? allWithdrawalRecords.filter((record) => record.actorId === userId)
      : allWithdrawalRecords

  const reservedTotal = sumReservedWithdrawals(ownWithdrawalRecords)
  const paidTotal = sumPaidWithdrawals(ownWithdrawalRecords)
  const availableBalance = Math.max(0, totalRevenue - reservedTotal)
  const recentWithdrawals = ownWithdrawalRecords.slice(0, 8).map((item) => ({
    ...item,
    requestedAt: item.requestedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  const reviewQueue =
    role === 'ADMIN'
      ? allWithdrawalRecords
          .filter(
            (record) =>
              record.actorRole === 'MANAGER' &&
              (record.status === 'REQUESTED' || record.status === 'APPROVED')
          )
          .slice(0, 20)
          .map((item) => ({
            ...item,
            requestedAt: item.requestedAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))
      : []

  const rows = payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    transactionId: payment.transactionId,
    createdAt: payment.createdAt.toISOString(),
    propertyTitle: payment.contract.property.title,
    tenantName: payment.contract.tenant.name || payment.contract.tenant.email,
  }))

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paiements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivi des encaissements, statuts de transaction et quittances.
          </p>
        </div>
        {canCreatePayment && (
          <Button asChild>
            <Link href={`/${locale}/dashboard/payments/new`}>
              <Plus className="h-4 w-4" />
              Nouveau paiement
            </Link>
          </Button>
        )}
      </header>

      <PaymentsTable payments={rows} />
      {canWithdraw ? (
        <WithdrawPanel
          availableBalance={availableBalance}
          reservedTotal={reservedTotal}
          paidTotal={paidTotal}
          recentWithdrawals={recentWithdrawals}
          reviewQueue={reviewQueue}
          isAdmin={role === 'ADMIN'}
        />
      ) : null}
    </section>
  )
}
