import { Badge } from '@/components/ui/badge'

type ContractWorkflowTimelineProps = {
  workflowState: string
  createdAt: string | null
  submittedAt: string | null
  ownerSignedAt: string | null
  tenantSignedAt: string | null
  paymentInitiatedAt: string | null
  activatedAt: string | null
}

type TimelineStep = {
  key: string
  label: string
  done: boolean
  active: boolean
  date: string | null
}

function workflowRank(state: string): number {
  if (state === 'ACTIVE') return 5
  if (state === 'PAYMENT_INITIATED') return 4
  if (state === 'SIGNED_BOTH') return 3
  if (state === 'SUBMITTED') return 2
  return 1
}

function formatDate(date: string | null): string | null {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function ContractWorkflowTimeline(props: ContractWorkflowTimelineProps) {
  const rank = workflowRank(props.workflowState)
  const hasBothSignatures = Boolean(props.ownerSignedAt && props.tenantSignedAt)

  const steps: TimelineStep[] = [
    {
      key: 'created',
      label: 'Cree',
      done: true,
      active: rank <= 1,
      date: props.createdAt,
    },
    {
      key: 'submitted',
      label: 'Soumis',
      done: Boolean(props.submittedAt) || rank >= 2,
      active: rank === 2,
      date: props.submittedAt,
    },
    {
      key: 'signed',
      label: 'Signe',
      done: hasBothSignatures || rank >= 3,
      active: rank === 3,
      date: props.tenantSignedAt ?? props.ownerSignedAt,
    },
    {
      key: 'payment',
      label: 'Paiement',
      done: Boolean(props.paymentInitiatedAt) || rank >= 4,
      active: rank === 4,
      date: props.paymentInitiatedAt,
    },
    {
      key: 'active',
      label: 'Actif',
      done: Boolean(props.activatedAt) || rank >= 5,
      active: rank === 5,
      date: props.activatedAt,
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 dark:bg-slate-900/50">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-secondary">Timeline contractuelle</p>
        <Badge variant="outline">{props.workflowState}</Badge>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((step) => {
          const tone = step.done ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          const ring = step.active ? 'ring-2 ring-primary/40' : ''
          return (
            <li key={step.key} className="space-y-1 rounded-lg border border-border px-2 py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone} ${ring}`} />
                <span className="text-xs font-medium text-primary">{step.label}</span>
              </div>
              <p className="text-[11px] text-secondary">{formatDate(step.date) ?? 'En attente'}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
