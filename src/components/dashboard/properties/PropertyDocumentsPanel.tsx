'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type LandDocument = {
  id: string
  title: string
  documentType: string
  url: string
  mimeType: string | null
  createdAt: string
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TITLE_DEED: 'Titre foncier',
  CADASTRAL_PLAN: 'Plan cadastral',
  TAX_RECEIPT: 'Quittance fiscale',
  OTHER: 'Autre',
}

type PropertyDocumentsPanelProps = {
  propertyId: string
}

export function PropertyDocumentsPanel({ propertyId }: PropertyDocumentsPanelProps) {
  const [documents, setDocuments] = useState<LandDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [documentType, setDocumentType] = useState('TITLE_DEED')

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        credentials: 'include',
      })
      const payload = await res.json().catch(() => [])
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Chargement impossible.')
        return
      }
      setDocuments(Array.isArray(payload) ? payload : [])
    } catch {
      setError('Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('documentType', documentType)
    setUploading(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Upload impossible.')
        return
      }
      form.reset()
      await loadDocuments()
    } catch {
      setError('Erreur reseau.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    setError('')
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/documents?documentId=${encodeURIComponent(documentId)}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Suppression impossible.')
        return
      }
      await loadDocuments()
    } catch {
      setError('Erreur reseau.')
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="font-semibold text-primary">Documents fonciers</h3>
        <p className="text-xs text-muted-foreground">
          Titres, plans cadastraux et pieces justificatives associes au bien.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-secondary">Chargement...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-secondary">Aucun document foncier.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-primary">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    Ouvrir
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-600"
                  onClick={() => void handleDelete(doc.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleUpload} className="space-y-3 border-t border-border pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="land-doc-title">Titre du document</Label>
            <Input id="land-doc-title" name="title" placeholder="Titre foncier lot 12" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="land-doc-file">Fichier (PDF ou image, max 5 Mo)</Label>
          <Input id="land-doc-file" name="file" type="file" accept=".pdf,image/*" required />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Envoi...' : 'Ajouter un document'}
        </Button>
      </form>
    </section>
  )
}
