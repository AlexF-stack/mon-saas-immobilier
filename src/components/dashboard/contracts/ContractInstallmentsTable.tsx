import { Badge } from '@/components/ui/badge'

type InstallmentRow = {
  id: string
  sequence: number
  dueDate: string
  baseAmount: number
  penaltyAmount: number
  totalDue: number
  status: 'OPEN' | 'OVERDUE' | 'PAID'
  paidAt: string | null
}

type ContractInstallmentsTableProps = {
  installments: InstallmentRow[]
}

function statusVariant(status: InstallmentRow['status']): 'outline' | 'warning' | 'success' {
  if (status === 'PAID') return 'success'
  if (status === 'OVERDUE') return 'warning'
  return 'outline'
}

function statusLabel(status: InstallmentRow['status']): string {
  if (status === 'PAID') return 'Paye'
  if (status === 'OVERDUE') return 'En retard'
  return 'Ouverte'
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ContractInstallmentsTable({ installments }: ContractInstallmentsTableProps) {
  if (installments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-secondary">
        Aucune echeance generee pour ce contrat.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-100/70 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Echeance</th>
            <th className="px-3 py-2">Base</th>
            <th className="px-3 py-2">Penalite</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Paye le</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-primary">{item.sequence}</td>
              <td className="px-3 py-2 text-secondary">{formatDate(item.dueDate)}</td>
              <td className="px-3 py-2 tabular-nums text-primary">{Math.round(item.baseAmount).toLocaleString('fr-FR')} FCFA</td>
              <td className="px-3 py-2 tabular-nums text-rose-600 dark:text-rose-300">
                {Math.round(item.penaltyAmount).toLocaleString('fr-FR')} FCFA
              </td>
              <td className="px-3 py-2 tabular-nums font-semibold text-primary">
                {Math.round(item.totalDue).toLocaleString('fr-FR')} FCFA
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
              </td>
              <td className="px-3 py-2 text-secondary">{formatDate(item.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
