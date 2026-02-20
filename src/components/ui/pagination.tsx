'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center justify-end gap-2', className)}
    >
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-lg"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label="Page precedente"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-2 text-sm text-slate-500 dark:text-slate-400">
        Page {page} sur {totalPages || 1}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-lg"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        aria-label="Page suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
