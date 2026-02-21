import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface EmptyStateProps extends React.ComponentProps<'div'> {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  icon?: React.ReactNode
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-border bg-card/85 px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/50',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-secondary dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-primary dark:text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-secondary dark:text-slate-400">{description}</p>
      )}
      {actionLabel && (onAction || actionHref) && (
        <div className="mt-5">
          {actionHref ? (
            <Button asChild size="sm">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
