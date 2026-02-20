'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

export interface CustomTableColumn<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
  statusMap?: Record<
    string,
    {
      label: string
      variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'
    }
  >
}

export interface CustomTableProps<T> {
  columns: CustomTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  emptyMessage?: string
  className?: string
}

export function CustomTable<T>({
  columns,
  data,
  keyExtractor,
  searchPlaceholder = 'Rechercher...',
  searchValue = '',
  onSearchChange,
  page = 1,
  totalPages = 1,
  onPageChange,
  emptyMessage = 'Aucun resultat.',
  className,
}: CustomTableProps<T>) {
  return (
    <div className={cn('space-y-4', className)}>
      {onSearchChange != null && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-900/80">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'sticky top-0 z-10 bg-inherit text-slate-500 dark:text-slate-400',
                    col.className
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow
                  key={keyExtractor(row)}
                  className={cn(
                    'group border-slate-200 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50',
                    idx % 2 === 1 && 'bg-slate-50/30 dark:bg-slate-900/40'
                  )}
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key]
                    let content: React.ReactNode

                    if (col.render) {
                      content = col.render(row)
                    } else if (col.statusMap && value != null && String(value) in col.statusMap) {
                      const status = col.statusMap[String(value)]
                      content = <Badge variant={status.variant}>{status.label}</Badge>
                    } else {
                      content = value != null ? String(value) : '-'
                    }

                    return (
                      <TableCell key={col.key} className={col.className}>
                        {content}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && onPageChange != null && (
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </div>
  )
}
