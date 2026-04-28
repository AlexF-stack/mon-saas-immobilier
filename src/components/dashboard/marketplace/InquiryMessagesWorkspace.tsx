'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type InquiryItem = {
  id: string
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  message: string | null
  lifecycleStage?: string
  createdAt: string
  property: { id: string; title: string }
}

type InquiryMessage = {
  id: string
  message: string
  createdAt: string
  senderUserId: string | null
  senderGuestName: string | null
  senderGuestEmail: string | null
  sender: { id: string; name: string | null; email: string; role: string } | null
}

type InquiryMessagesWorkspaceProps = {
  currentUserId?: string
}

export function InquiryMessagesWorkspace({ currentUserId }: InquiryMessagesWorkspaceProps = {}) {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [inquiries, setInquiries] = useState<InquiryItem[]>([])
  const [selectedInquiryId, setSelectedInquiryId] = useState<string>('')
  const [messages, setMessages] = useState<InquiryMessage[]>([])
  const [draft, setDraft] = useState('')
  const inquiryFromQuery = searchParams.get('inquiryId') ?? ''

  const filtered = useMemo(() => {
    if (!search.trim()) return inquiries
    const q = search.trim().toLowerCase()
    return inquiries.filter(
      (item) =>
        item.requesterName.toLowerCase().includes(q) ||
        item.requesterEmail.toLowerCase().includes(q) ||
        item.property.title.toLowerCase().includes(q)
    )
  }, [inquiries, search])

  // Load inquiries
  useEffect(() => {
    let cancelled = false
    async function loadInquiries() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/marketplace/inquiries?limit=50', { credentials: 'include' })
        const payload = await res.json().catch(() => [])
        if (!res.ok) {
          if (!cancelled) setError(typeof payload?.error === 'string' ? payload.error : 'Chargement impossible.')
          return
        }
        if (!cancelled) {
          const rows = Array.isArray(payload) ? (payload as InquiryItem[]) : []
          setInquiries(rows)
          const hasQueryMatch = inquiryFromQuery && rows.some((row) => row.id === inquiryFromQuery)
          if (hasQueryMatch) {
            setSelectedInquiryId(inquiryFromQuery)
          } else if (rows.length > 0) {
            setSelectedInquiryId((prev) => prev || rows[0].id)
          }
        }
      } catch {
        if (!cancelled) setError('Erreur reseau lors du chargement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadInquiries()
    return () => {
      cancelled = true
    }
  }, [inquiryFromQuery])

  // Load and poll messages
  useEffect(() => {
    if (!selectedInquiryId) return
    let cancelled = false

    async function loadMessages() {
      try {
        const res = await fetch(`/api/marketplace/inquiries/${selectedInquiryId}/messages`, {
          credentials: 'include',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (!cancelled) {
          setMessages(Array.isArray(payload?.messages) ? payload.messages : [])
        }
      } catch {
        // Silent catch for polling
      }
    }

    void loadMessages()
    const interval = setInterval(() => {
      void loadMessages()
    }, 10000) // Poll every 10 seconds

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedInquiryId])

  async function sendMessage() {
    const text = draft.trim()
    if (!text || !selectedInquiryId) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/marketplace/inquiries/${selectedInquiryId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Envoi impossible.')
        return
      }
      if (payload?.message) {
        setMessages((prev) => [...prev, payload.message as InquiryMessage])
      }
      setDraft('')
    } catch {
      setError('Erreur reseau lors de l envoi.')
    } finally {
      setSending(false)
    }
  }

  const selectedInquiry = inquiries.find((i) => i.id === selectedInquiryId)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-1 flex flex-col max-h-[600px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une demande..."
          className="mb-3"
        />
        <div className="flex-1 space-y-2 overflow-y-auto pr-2">
          {loading ? (
            <p className="text-sm text-secondary text-center py-4">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-secondary text-center py-4">Aucune demande.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedInquiryId(item.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  selectedInquiryId === item.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-surface/70'
                }`}
              >
                <p className="font-semibold text-primary truncate">{item.property.title}</p>
                <p className="text-sm text-secondary truncate">{item.requesterName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card lg:col-span-2 flex flex-col h-[600px]">
        {selectedInquiry ? (
          <div className="border-b border-border p-4 bg-surface/50 rounded-t-2xl flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">{selectedInquiry.property.title}</h3>
              <p className="text-sm text-secondary">Avec {selectedInquiry.requesterName}</p>
            </div>
            {error && <span className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-md">{error}</span>}
          </div>
        ) : (
          <div className="border-b border-border p-4 bg-surface/50 rounded-t-2xl h-16" />
        )}

        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-background/50">
          {selectedInquiryId ? (
            messages.length > 0 ? (
              messages.map((item) => {
                const isMe = currentUserId === item.senderUserId
                return (
                  <div key={item.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] text-muted-foreground">
                        {!isMe &&
                          (item.sender?.name ??
                            item.sender?.email ??
                            item.senderGuestName ??
                            item.senderGuestEmail ??
                            'Invite')}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-card border border-border rounded-tl-sm text-primary'
                      }`}
                    >
                      {item.message}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-secondary">Aucun message. Envoyez le premier !</p>
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-secondary">Selectionnez une demande pour voir la conversation.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface/50 border-t border-border rounded-b-2xl">
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ecrire un message..."
              className="min-h-[44px] max-h-32 resize-y"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <Button
              type="button"
              onClick={sendMessage}
              disabled={sending || !selectedInquiryId || !draft.trim()}
              className="h-auto shrink-0"
            >
              {sending ? '...' : 'Envoyer'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}


