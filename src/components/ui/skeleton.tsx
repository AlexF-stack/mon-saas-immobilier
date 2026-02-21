import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                'shimmer-surface rounded-md border border-border/40',
                className
            )}
        />
    )
}
