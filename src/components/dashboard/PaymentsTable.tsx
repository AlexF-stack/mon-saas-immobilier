'use client'

import { useMemo, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { CustomTable } from '@/components/ui/custom-table'
import { EmptyState } from '@/components/ui/empty-state'

export interface PaymentRow {
  id: string
  amount: number
  status: string
  method: string
  transactionId: string | null
  createdAt: string
  propertyTitle: string
  tenantName: string
}

interface PaymentsTableProps {
  payments: PaymentRow[]
}

const PAGE_SIZE = 10

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return payments
    const query = search.toLowerCase().trim()
    return payments.filter(
      (payment) =>
        payment.propertyTitle.toLowerCase().includes(query) ||
        payment.tenantName.toLowerCase().includes(query) ||
        payment.method.toLowerCase().includes(query) ||
        (payment.transactionId ?? '').toLowerCase().includes(query)
    )
  }, [payments, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const slice = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucun paiement"
        description="Les paiements apparaitront ici des qu une transaction sera initiee."
        icon={<CreditCard className="h-6 w-6" />}
      />
    )
  }

  return (
    <CustomTable<PaymentRow>
      columns={[
        {
          key: 'propertyTitle',
          header: 'Bien',
          render: (row) => <span className="font-medium">{row.propertyTitle}</span>,
        },
        {
          key: 'tenantName',
          header: 'Locataire',
        },
        {
          key: 'amount',
          header: 'Montant',
          render: (row) => (
            <span className="font-medium tabular-nums">{row.amount.toLocaleString('fr-FR')} FCFA</span>
          ),
        },
        {
          key: 'status',
          header: 'Statut',
          statusMap: {
            COMPLETED: { label: 'Paye', variant: 'success' },
            PENDING: { label: 'En attente', variant: 'warning' },
            FAILED: { label: 'Echoue', variant: 'destructive' },
          },
        },
        {
          key: 'id',
          header: 'Quittance',
          render: (row) =>
                row.status === 'COMPLETED' ? (
              <a
                href={`/api/payments/${row.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline underline-offset-2 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 dark:text-blue-400"
              >
                PDF
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            ),
        },
        {
          key: 'method',
          header: 'Methode',
        },
        {
          key: 'createdAt',
          header: 'Date',
          render: (row) => new Date(row.createdAt).toLocaleDateString('fr-FR'),
        },
      ]}
      data={slice}
      keyExtractor={(row) => row.id}
      searchPlaceholder="Rechercher un paiement..."
      searchValue={search}
      onSearchChange={setSearch}
      page={currentPage}
      totalPages={totalPages}
      onPageChange={setPage}
      emptyMessage="Aucun paiement ne correspond a votre recherche."
    />
  )
}
