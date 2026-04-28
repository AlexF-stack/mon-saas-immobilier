'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type ManualReminderButtonProps = {
  contractId: string
}

const DAY_OPTIONS = [7, 5, 3, 1, 0] as const

export function ManualReminderButton({ contractId }: ManualReminderButtonProps) {
  const [daysBefore, setDaysBefore] = useState<number>(7)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function sendReminder() {
    if (loading) return
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/payments/reminders/manual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          daysBefore,
          channels: ['EMAIL', 'SMS', 'WHATSAPP'],
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const fallback = 'Echec envoi rappel.'
        const details =
          typeof payload?.error === 'string'
            ? payload.error
            : Array.isArray(payload?.error) && typeof payload.error[0]?.message === 'string'
              ? payload.error[0].message
              : fallback
        setError(details)
        return
      }

      setMessage(
        typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message
          : 'Rappel envoye.'
      )
    } catch {
      setError('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={String(daysBefore)}
          onChange={(event) => setDaysBefore(Number(event.target.value))}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-primary outline-none"
          aria-label="Delai rappel"
        >
          {DAY_OPTIONS.map((value) => (
            <option key={value} value={String(value)}>
              {value === 0 ? "Jour d'echeance (J)" : `Rappel J-${value}`}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={sendReminder} disabled={loading}>
          {loading ? 'Envoi...' : 'Rappeler locataire'}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </div>
  )
}
