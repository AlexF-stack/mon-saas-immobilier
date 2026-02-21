import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatCardProps extends React.ComponentProps<'div'> {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  iconBg?: 'primary' | 'accent' | 'success' | 'warning' | 'muted'
  trend?: { value: number; label?: string }
}

const iconBgClasses = {
  primary: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  accent: 'bg-surface text-secondary dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
  muted: 'bg-surface text-secondary dark:bg-slate-800 dark:text-slate-400',
} as const

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'primary',
  trend,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 elevation-1',
        'animate-fade-up hover-lift-soft hover-depth-3d transition-[box-shadow,transform] [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)] dark:border-slate-800 dark:bg-slate-900/60',
        className
      )}
      {...props}
    >
      <div className="flex flex-row items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary dark:text-slate-400">{title}</p>
        {icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBgClasses[iconBg])}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight text-primary tabular-nums dark:text-slate-100">{value}</p>
        {(subtitle != null || trend != null) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-secondary dark:text-slate-400">
            {subtitle && <span>{subtitle}</span>}
            {trend != null && (
              <span className={cn('font-medium', trend.value >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {trend.value >= 0 ? '+' : '-'} {Math.abs(trend.value).toFixed(1)}%
                {trend.label != null ? ` ${trend.label}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
