import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export function MarketplacePropertySkeleton() {
  return (
    <div className="animate-pulse">
      <Card className="glass-card overflow-hidden border border-border bg-card">
        <div className="h-44 w-full bg-surface" />
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="h-4 w-40 rounded-full bg-surface" />
            <div className="flex gap-2">
              <div className="h-5 w-14 rounded-full bg-surface" />
              <div className="h-5 w-16 rounded-full bg-surface" />
            </div>
          </div>
          <div className="h-3 w-48 rounded-full bg-surface" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-6 w-32 rounded-full bg-surface" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-surface" />
            <div className="h-5 w-20 rounded-full bg-surface" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-surface" />
            <div className="h-3 w-4/5 rounded-full bg-surface" />
          </div>
        </CardContent>
        <CardFooter>
          <div className="h-9 w-full rounded-xl bg-surface" />
        </CardFooter>
      </Card>
    </div>
  )
}

