'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/lib/auth'

type UserAdminActionsProps = {
    userId: string
    currentUserId: string
    currentRole: UserRole
    isSuspended: boolean
}

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'MANAGER', 'TENANT']

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
    if (typeof errorPayload === 'string' && errorPayload.trim()) {
        return errorPayload
    }

    if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
        return String(errorPayload[0].message)
    }

    if (status === 401) return 'Session expirée. Reconnectez-vous.'
    if (status === 403) return 'Accès refusé.'

    return fallback
}

export function UserAdminActions({
    userId,
    currentUserId,
    currentRole,
    isSuspended,
}: UserAdminActionsProps) {
    const router = useRouter()
    const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole)
    const [loadingAction, setLoadingAction] = useState<'role' | 'suspend' | null>(null)
    const [error, setError] = useState('')

    async function updateRole() {
        setError('')
        setLoadingAction('role')
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: selectedRole }),
            })

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                setError(toErrorMessage(res.status, payload.error, 'Role update failed'))
                return
            }

            router.refresh()
        } catch {
            setError('Network error')
        } finally {
            setLoadingAction(null)
        }
    }

    async function toggleSuspension() {
        setError('')
        setLoadingAction('suspend')
        try {
            const res = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suspended: !isSuspended }),
            })

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                setError(toErrorMessage(res.status, payload.error, 'Suspension update failed'))
                return
            }

            router.refresh()
        } catch {
            setError('Network error')
        } finally {
            setLoadingAction(null)
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as UserRole)}
                    disabled={loadingAction !== null}
                    aria-label="Role"
                >
                    {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                            {role}
                        </option>
                    ))}
                </select>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={updateRole}
                    disabled={loadingAction !== null || selectedRole === currentRole}
                >
                    {loadingAction === 'role' ? 'Saving...' : 'Update role'}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={isSuspended ? 'secondary' : 'destructive'}
                    onClick={toggleSuspension}
                    disabled={loadingAction !== null || userId === currentUserId}
                >
                    {loadingAction === 'suspend'
                        ? 'Saving...'
                        : isSuspended
                            ? 'Reactivate'
                            : 'Suspend'}
                </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {userId === currentUserId && (
                <p className="text-xs text-muted-foreground">Your account cannot be suspended.</p>
            )}
        </div>
    )
}
