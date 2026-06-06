'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type PaymentConfirmButtonProps = {
  paymentId: string
  canConfirm: boolean
}

export function PaymentConfirmButton({ paymentId, canConfirm }: PaymentConfirmButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!canConfirm) return null

  async function handleConfirm() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/payments/${paymentId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(typeof result?.error === 'string' ? result.error : 'Confirmation impossible.')
        return
      }
      setMessage(typeof result?.message === 'string' ? result.message : 'Paiement confirme.')
      router.refresh()
    } catch {
      setMessage('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void handleConfirm()}>
        {loading ? 'Confirmation...' : 'Confirmer reception'}
      </Button>
      {message ? <span className="text-xs text-emerald-600">{message}</span> : null}
    </div>
  )
}
