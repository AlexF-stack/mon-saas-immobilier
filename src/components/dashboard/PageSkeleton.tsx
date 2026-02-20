import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function PageSkeleton() {
    return (
        <div className="animate-in fade-in space-y-6 duration-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="h-8 w-56 rounded-lg bg-slate-200/70 dark:bg-slate-800" />
                <div className="h-9 w-40 rounded-lg bg-slate-200/70 dark:bg-slate-800" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="min-w-0">
                        <CardHeader className="pb-2">
                            <div className="h-5 w-3/4 rounded bg-slate-200/70 dark:bg-slate-800" />
                            <div className="mt-2 h-4 w-1/2 rounded bg-slate-200/50 dark:bg-slate-800/80" />
                        </CardHeader>
                        <CardContent>
                            <div className="mb-2 h-6 w-24 rounded bg-slate-200/70 dark:bg-slate-800" />
                            <div className="h-3 w-full rounded bg-slate-200/50 dark:bg-slate-800/80" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
