import Link from 'next/link'
import { Button } from '@/components/ui/button'

type ServerPagerProps = {
  page: number
  totalPages: number
  buildHref: (targetPage: number) => string
}

export function ServerPager({ page, totalPages, buildHref }: ServerPagerProps) {
  if (totalPages <= 1) return null

  const previousPage = Math.max(1, page - 1)
  const nextPage = Math.min(totalPages, page + 1)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-secondary">
        Page {page} / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(previousPage)}>Precedent</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Precedent
          </Button>
        )}

        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(nextPage)}>Suivant</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Suivant
          </Button>
        )}
      </div>
    </div>
  )
}
