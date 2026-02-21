import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton() {
    return (
        <div className="animate-in fade-in space-y-6 duration-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-8 w-56 rounded-lg" />
                <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="min-w-0">
                        <CardHeader className="pb-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="mt-2 h-4 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="mb-2 h-6 w-24" />
                            <Skeleton className="h-3 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
