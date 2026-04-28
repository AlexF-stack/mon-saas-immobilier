'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type InquiryMessage = {
  id: string
  message: string
  createdAt: string
  senderUserId: string | null
  senderGuestName: string | null
  senderGuestEmail: string | null
  sender: { id: string; name: string | null; email: string; role: string } | null
}

type Props = {
  inquiryId: string
  guestToken?: string
  currentUserId?: string | null
}

export function PublicInquiryChat({ inquiryId, guestToken, currentUserId }: Props) {
  const [messages, setMessages] = useState<InquiryMessage[]>([])
  const [requesterName, setRequesterName] = useState('')
  const [propertyTitle, setPropertyTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (guestToken) params.set('guestToken', guestToken)
        const res = await fetch(`/api/marketplace/inquiries/${inquiryId}/messages?${params.toString()}`, {
          credentials: 'include',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) {
            setError(typeof payload?.error === 'string' ? payload.error : 'Conversation inaccessible.')
          }
          return
        }
        if (!cancelled) {
          setMessages(Array.isArray(payload?.messages) ? payload.messages : [])
          setRequesterName(payload?.inquiry?.requesterName ?? '')
          setPropertyTitle(payload?.inquiry?.propertyTitle ?? '')
        }
      } catch {
        if (!cancelled) setError('Erreur reseau.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMessages()
    const interval = setInterval(() => {
      void loadMessages()
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [guestToken, inquiryId])

  async function sendMessage() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/marketplace/inquiries/${inquiryId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          guestToken: guestToken || undefined,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Envoi impossible.')
        return
      }
      if (payload?.message) {
        setMessages((prev) => [...prev, payload.message as InquiryMessage])
        setDraft('')
      }
    } catch {
      setError('Erreur reseau.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-xl font-semibold text-primary">Conversation de visite</h1>
        <p className="text-sm text-secondary">
          {propertyTitle ? `${propertyTitle} - ` : ''}discussion avec {requesterName || 'le proprietaire'}.
        </p>
      </div>

      <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-secondary">Chargement...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-secondary">Aucun message pour le moment.</p>
          ) : (
            messages.map((item) => {
              const isMe = currentUserId ? item.senderUserId === currentUserId : !item.senderUserId
              const label = item.sender?.name ?? item.sender?.email ?? item.senderGuestName ?? item.senderGuestEmail ?? 'Invite'
              return (
                <div key={item.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {!isMe ? <span>{label}</span> : null}
                    <span>
                      {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'rounded-tl-sm border border-border bg-background text-primary'
                    }`}
                  >
                    {item.message}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t border-border bg-surface/40 p-4">
          {error ? <p className="mb-2 text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ecrire un message..."
              className="min-h-[44px] max-h-32 resize-y"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <Button type="button" disabled={sending || !draft.trim()} onClick={() => void sendMessage()}>
              {sending ? '...' : 'Envoyer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
