import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
            <div className="h-8 w-48 sm:h-9 sm:w-56 bg-muted rounded-md" />
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="min-w-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-4 w-24 bg-muted rounded" />
                            <div className="h-4 w-4 bg-muted rounded" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-7 w-28 bg-muted rounded mb-2" />
                            <div className="h-3 w-32 bg-muted/80 rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
