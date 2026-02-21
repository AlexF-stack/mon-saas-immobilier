'use client'

import Link from 'next/link'
import { CreditCard, FileText, Building } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActivityItem {
  id: string
  type: 'payment' | 'contract' | 'property'
  title: string
  subtitle?: string
  amount?: number
  date: Date
  href?: string
}

interface RecentActivityProps {
  items: ActivityItem[]
  className?: string
}

const typeIcon = {
  payment: CreditCard,
  contract: FileText,
  property: Building,
}

export function RecentActivity({ items, className }: RecentActivityProps) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Aucune activite recente</p>
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {items.map((item) => {
        const Icon = typeIcon[item.type]
        const content = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
              {item.subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>}
            </div>
            <div className="shrink-0 text-right">
              {item.amount != null && (
                <p className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {item.amount.toLocaleString('fr-FR')} FCFA
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          </>
        )

        const wrapperClass =
          'animate-fade-up flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors duration-150 hover:border-slate-200/60 hover:bg-slate-50 dark:hover:border-slate-700/60 dark:hover:bg-slate-800/50'

        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className={wrapperClass}>
                {content}
              </Link>
            ) : (
              <div className={wrapperClass}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
