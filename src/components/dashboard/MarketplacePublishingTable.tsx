'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomTable } from '@/components/ui/custom-table'

export type MarketplacePropertyRow = {
    id: string
    title: string
    city?: string | null
    address: string
    price: number
    status: string
    propertyType: string
    isPublished: boolean
    isPremium: boolean
    viewsCount: number
    impressionsCount: number
    inquiriesCount: number
    publishedAt: string | null
}

type MarketplacePublishingTableProps = {
    rows: MarketplacePropertyRow[]
    locale?: string
    dashboardPathPrefix: string
    canManagePremium?: boolean
}

const PAGE_SIZE = 10

function statusLabel(status: string) {
    if (status === 'AVAILABLE') return 'Disponible'
    if (status === 'RENTED') return 'Loue'
    if (status === 'MAINTENANCE') return 'Maintenance'
    return status
}

function propertyTypeLabel(propertyType: string) {
    if (propertyType === 'APARTMENT') return 'Appartement'
    if (propertyType === 'HOUSE') return 'Maison'
    if (propertyType === 'STUDIO') return 'Studio'
    if (propertyType === 'COMMERCIAL') return 'Commercial'
    return propertyType
}

export function MarketplacePublishingTable({
    rows,
    locale,
    dashboardPathPrefix,
    canManagePremium = false,
}: MarketplacePublishingTableProps) {
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [data, setData] = useState(rows)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [error, setError] = useState('')

    const filtered = useMemo(() => {
        if (!search.trim()) return data
        const query = search.toLowerCase().trim()
        return data.filter(
            (row) =>
                row.title.toLowerCase().includes(query) ||
                row.address.toLowerCase().includes(query) ||
                row.propertyType.toLowerCase().includes(query)
        )
    }, [data, search])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const pageRows = useMemo(
        () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [filtered, currentPage]
    )

    const marketplacePrefix = locale ? `/${locale}/marketplace` : '/marketplace'

    async function togglePublish(row: MarketplacePropertyRow) {
        setPendingId(row.id)
        setError('')

        try {
            const response = await fetch(`/api/marketplace/properties/${row.id}/publish`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: !row.isPublished }),
            })

            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                setError(typeof result.error === 'string' ? result.error : 'Impossible de modifier la publication.')
                return
            }

            setData((previous) =>
                previous.map((item) =>
                    item.id === row.id
                        ? {
                              ...item,
                              isPublished: result.isPublished,
                              isPremium: result.isPremium ?? item.isPremium,
                              publishedAt: result.publishedAt ?? null,
                          }
                        : item
                )
            )
        } catch {
            setError('Erreur reseau lors de la mise a jour.')
        } finally {
            setPendingId(null)
        }
    }

    async function togglePremium(row: MarketplacePropertyRow) {
        setPendingId(row.id)
        setError('')

        try {
            const response = await fetch(`/api/marketplace/properties/${row.id}/publish`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPublished: row.isPublished,
                    isPremium: !row.isPremium,
                }),
            })

            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                setError(typeof result.error === 'string' ? result.error : 'Impossible de modifier le mode premium.')
                return
            }

            setData((previous) =>
                previous.map((item) =>
                    item.id === row.id
                        ? {
                              ...item,
                              isPremium: result.isPremium ?? !row.isPremium,
                              isPublished: result.isPublished ?? row.isPublished,
                              publishedAt: result.publishedAt ?? row.publishedAt,
                          }
                        : item
                )
            )
        } catch {
            setError('Erreur reseau lors de la mise a jour premium.')
        } finally {
            setPendingId(null)
        }
    }

    async function deleteProperty(row: MarketplacePropertyRow) {
        if (!window.confirm(`Supprimer definitivement "${row.title}" ?`)) {
            return
        }

        setPendingId(row.id)
        setError('')

        try {
            const response = await fetch(`/api/properties/${row.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                setError(typeof result.error === 'string' ? result.error : 'Suppression impossible.')
                return
            }

            setData((previous) => previous.filter((item) => item.id !== row.id))
        } catch {
            setError('Erreur reseau lors de la suppression.')
        } finally {
            setPendingId(null)
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
                    {error}
                </div>
            )}

            <CustomTable<MarketplacePropertyRow>
                columns={[
                    {
                        key: 'title',
                        header: 'Bien',
                        render: (row) => <span className="font-medium">{row.title}</span>,
                    },
                    {
                        key: 'propertyType',
                        header: 'Type',
                        render: (row) => propertyTypeLabel(row.propertyType),
                    },
                    {
                        key: 'address',
                        header: 'Localisation',
                        render: (row) => <span className="line-clamp-1">{[row.city, row.address].filter(Boolean).join(', ')}</span>,
                    },
                    {
                        key: 'price',
                        header: 'Prix',
                        render: (row) => `${row.price.toLocaleString('fr-FR')} FCFA`,
                    },
                    {
                        key: 'status',
                        header: 'Statut',
                        render: (row) => (
                            <Badge variant={row.status === 'AVAILABLE' ? 'success' : 'warning'}>
                                {statusLabel(row.status)}
                            </Badge>
                        ),
                    },
                    {
                        key: 'isPublished',
                        header: 'Publication',
                        render: (row) => (
                            <div className="flex items-center gap-1.5">
                                {row.isPremium ? <Badge variant="default">Premium</Badge> : null}
                                <Badge variant={row.isPublished ? 'default' : 'secondary'}>
                                    {row.isPublished ? 'Publie' : 'Non publie'}
                                </Badge>
                            </div>
                        ),
                    },
                    {
                        key: 'id-signals',
                        header: 'Signals',
                        render: (row) => (
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                <p>Impr.: {row.impressionsCount}</p>
                                <p>Vues: {row.viewsCount}</p>
                                <p>Inquiries: {row.inquiriesCount}</p>
                            </div>
                        ),
                    },
                    {
                        key: 'id',
                        header: 'Actions',
                        render: (row) => (
                            <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={row.isPublished ? 'outline' : 'default'}
                                    disabled={pendingId === row.id}
                                    onClick={() => togglePublish(row)}
                                >
                                    {pendingId === row.id
                                        ? '...'
                                        : row.isPublished
                                            ? 'Retirer'
                                            : 'Publier'}
                                </Button>
                                <Button asChild size="sm" variant="ghost">
                                    <Link href={`${marketplacePrefix}/${row.id}`}>
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild size="sm" variant="ghost">
                                    <Link href={`${dashboardPathPrefix}/properties`}>Gerer</Link>
                                </Button>
                                {canManagePremium ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={row.isPremium ? 'outline' : 'default'}
                                        disabled={pendingId === row.id}
                                        onClick={() => togglePremium(row)}
                                    >
                                        {pendingId === row.id ? '...' : row.isPremium ? 'Standard' : 'Premium'}
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={pendingId === row.id}
                                    onClick={() => deleteProperty(row)}
                                >
                                    Supprimer
                                </Button>
                            </div>
                        ),
                    },
                ]}
                data={pageRows}
                keyExtractor={(row) => row.id}
                searchPlaceholder="Rechercher un bien..."
                searchValue={search}
                onSearchChange={setSearch}
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                emptyMessage="Aucun bien ne correspond aux filtres."
            />
        </div>
    )
}
