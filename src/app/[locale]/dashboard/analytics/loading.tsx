import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardAnalyticsLoading() {
  return (
    <section className="space-y-6">
      <div className="glass-card rounded-2xl border border-border p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="glass-card rounded-2xl border border-border p-6">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="mt-4 h-8 w-32 rounded-lg" />
            <Skeleton className="mt-3 h-3 w-40 rounded-full" />
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-border p-6">
        <Skeleton className="h-6 w-60 rounded-lg" />
        <Skeleton className="mt-4 h-72 w-full rounded-2xl" />
      </div>
    </section>
  )
}
