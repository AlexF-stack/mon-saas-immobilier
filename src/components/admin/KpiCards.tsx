'use client'

import { FileText, TrendingUp, UserPlus, Wallet, WalletCards } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { AnimatedCounter } from '@/components/admin/AnimatedCounter'

export type KpiTotals = {
  signups: number
  contracts: number
  grossVolume: number
  withdrawalVolume: number
  netCashFlow: number
}

type KpiCardsProps = {
  current: KpiTotals
  previous: KpiTotals
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

function count(value: number) {
  return value.toLocaleString('fr-FR')
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`
}

export function KpiCards({ current, previous }: KpiCardsProps) {
  const signupsTrend = pctChange(current.signups, previous.signups)
  const contractsTrend = pctChange(current.contracts, previous.contracts)
  const grossTrend = pctChange(current.grossVolume, previous.grossVolume)
  const withdrawTrend = pctChange(current.withdrawalVolume, previous.withdrawalVolume)
  const cashflowTrend = pctChange(current.netCashFlow, previous.netCashFlow)

  const glowClass = (trend: number) =>
    trend > 0
      ? 'ring-1 ring-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_10px_30px_rgba(16,185,129,0.12)]'
      : ''

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
      <StatCard
        title="Total Signups"
        value={<AnimatedCounter value={current.signups} format={count} />}
        trend={{ value: signupsTrend, label: 'vs periode precedente' }}
        icon={<UserPlus className="h-5 w-5" />}
        iconBg="accent"
        className={`glass-card backdrop-blur-md ${glowClass(signupsTrend)}`}
      />
      <StatCard
        title="Total Contracts"
        value={<AnimatedCounter value={current.contracts} format={count} />}
        trend={{ value: contractsTrend, label: 'vs periode precedente' }}
        icon={<FileText className="h-5 w-5" />}
        iconBg="muted"
        className={`glass-card backdrop-blur-md ${glowClass(contractsTrend)}`}
      />
      <StatCard
        title="Gross Volume"
        value={<AnimatedCounter value={current.grossVolume} format={money} />}
        trend={{ value: grossTrend, label: 'vs periode precedente' }}
        icon={<Wallet className="h-5 w-5" />}
        iconBg="primary"
        className={`glass-card backdrop-blur-md ${glowClass(grossTrend)}`}
      />
      <StatCard
        title="Withdrawal Volume"
        value={<AnimatedCounter value={current.withdrawalVolume} format={money} />}
        trend={{
          value: withdrawTrend,
          label: 'vs periode precedente',
        }}
        icon={<WalletCards className="h-5 w-5" />}
        iconBg="warning"
        className="glass-card backdrop-blur-md"
      />
      <StatCard
        title="Net Cash Flow"
        value={<AnimatedCounter value={current.netCashFlow} format={money} />}
        trend={{ value: cashflowTrend, label: 'vs periode precedente' }}
        icon={<TrendingUp className="h-5 w-5" />}
        iconBg={current.netCashFlow >= 0 ? 'success' : 'warning'}
        className={`glass-card backdrop-blur-md ${glowClass(cashflowTrend)}`}
      />
    </div>
  )
}
