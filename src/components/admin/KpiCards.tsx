import { FileText, TrendingUp, UserPlus, Wallet, WalletCards } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'

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
  return `${value.toLocaleString('fr-FR')} FCFA`
}

export function KpiCards({ current, previous }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
      <StatCard
        title="Total Signups"
        value={count(current.signups)}
        trend={{ value: pctChange(current.signups, previous.signups), label: 'vs periode precedente' }}
        icon={<UserPlus className="h-5 w-5" />}
        iconBg="accent"
      />
      <StatCard
        title="Total Contracts"
        value={count(current.contracts)}
        trend={{ value: pctChange(current.contracts, previous.contracts), label: 'vs periode precedente' }}
        icon={<FileText className="h-5 w-5" />}
        iconBg="muted"
      />
      <StatCard
        title="Gross Volume"
        value={money(current.grossVolume)}
        trend={{ value: pctChange(current.grossVolume, previous.grossVolume), label: 'vs periode precedente' }}
        icon={<Wallet className="h-5 w-5" />}
        iconBg="primary"
      />
      <StatCard
        title="Withdrawal Volume"
        value={money(current.withdrawalVolume)}
        trend={{
          value: pctChange(current.withdrawalVolume, previous.withdrawalVolume),
          label: 'vs periode precedente',
        }}
        icon={<WalletCards className="h-5 w-5" />}
        iconBg="warning"
      />
      <StatCard
        title="Net Cash Flow"
        value={money(current.netCashFlow)}
        trend={{ value: pctChange(current.netCashFlow, previous.netCashFlow), label: 'vs periode precedente' }}
        icon={<TrendingUp className="h-5 w-5" />}
        iconBg={current.netCashFlow >= 0 ? 'success' : 'warning'}
      />
    </div>
  )
}
