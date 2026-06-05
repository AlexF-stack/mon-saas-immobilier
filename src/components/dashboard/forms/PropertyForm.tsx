'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type PropertyFormProps = {
  locale?: string
  dashboardPathPrefix?: string
  initialData?: {
    id: string
    title: string
    city: string | null
    address: string
    price: number
    description: string | null
    propertyType: string
    offerType: string
    status: string
  }
}

const MIN_PROPERTY_IMAGES = 3
const MIN_LAND_DOCUMENTS = 1

const LAND_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TITLE_DEED: 'Titre foncier',
  CADASTRAL_PLAN: 'Plan cadastral',
  TAX_RECEIPT: 'Quittance fiscale',
  OTHER: 'Autre',
}

function toErrorMessage(status: number, errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return errorPayload
  }

  if (Array.isArray(errorPayload) && typeof errorPayload[0]?.message === 'string') {
    return String(errorPayload[0].message)
  }

  if (status === 401) return 'Session expirée. Reconnectez-vous.'
  if (status === 403) return 'Accès refusé.'
  if (status === 409) return 'Conflit détecté. Actualisez la page puis réessayez.'

  return fallback
}

export function PropertyForm({ locale, dashboardPathPrefix, initialData }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offerType, setOfferType] = useState<'RENT' | 'SALE'>((initialData?.offerType as 'RENT' | 'SALE') || 'RENT')
  const [landDocumentType, setLandDocumentType] = useState('TITLE_DEED')
  const dashboardPath = dashboardPathPrefix ?? (locale ? `/${locale}/dashboard` : '/dashboard')
  const isEdit = Boolean(initialData)

  const landDocOptions = Object.entries(LAND_DOCUMENT_TYPE_LABELS).filter(
    ([value]) => offerType === 'SALE' || value !== 'TITLE_DEED'
  )
  const landDocDefault = landDocOptions.length > 0 ? landDocOptions[0][0] : ''

  useEffect(() => {
    setLandDocumentType((current) =>
      landDocOptions.some(([value]) => value === current) ? current : landDocDefault
    )
  }, [landDocDefault, landDocOptions])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const selectedImages = formData
      .getAll('images')
      .filter((value): value is File => value instanceof File && value.size > 0)
    const selectedLandDocs = formData
      .getAll('landDocuments')
      .filter((value): value is File => value instanceof File && value.size > 0)

    if (!isEdit && selectedImages.length < MIN_PROPERTY_IMAGES) {
      setError(`Ajoute au moins ${MIN_PROPERTY_IMAGES} images pour créer le bien.`)
      setLoading(false)
      return
    }

    if (!isEdit && selectedLandDocs.length < MIN_LAND_DOCUMENTS) {
      setError(`Ajoute au moins ${MIN_LAND_DOCUMENTS} document foncier (PDF ou image).`)
      setLoading(false)
      return
    }

    try {
      const url = isEdit ? `/api/properties/${initialData!.id}` : '/api/properties'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        body: formData,
      })

      if (res.ok) {
        router.push(`${dashboardPath}/properties`)
        router.refresh()
        return
      }

      const payload = await res.json().catch(() => ({}))
      setError(toErrorMessage(res.status, payload?.error, `Erreur lors de la ${isEdit ? 'modification' : 'création'} du bien.`))
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{isEdit ? 'Modifier le bien' : 'Détails du bien'}</CardTitle>
          <CardDescription>
            {isEdit ? 'Mettez à jour les informations de votre propriété.' : 'Renseignez les informations du nouveau bien immobilier.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" defaultValue={initialData?.title} placeholder="Appartement T3 Centre Ville" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" defaultValue={initialData?.city ?? ''} placeholder="Ex: Cotonou" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" defaultValue={initialData?.address} placeholder="123 Rue de la Paix, Cotonou" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">{offerType === 'SALE' ? 'Prix de vente (FCFA)' : 'Loyer mensuel (FCFA)'}</Label>
            <Input id="price" name="price" type="number" min="1" defaultValue={initialData?.price} placeholder="150000" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offerType">Type d&apos;offre</Label>
            <Select
              name="offerType"
              value={offerType}
              onValueChange={(value) => setOfferType(value === 'SALE' ? 'SALE' : 'RENT')}
            >
              <SelectTrigger id="offerType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RENT">Location</SelectItem>
                <SelectItem value="SALE">Vente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyType">Type de bien</Label>
            <Select name="propertyType" defaultValue={initialData?.propertyType || "APARTMENT"}>
              <SelectTrigger id="propertyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APARTMENT">Appartement</SelectItem>
                <SelectItem value="HOUSE">Maison</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="LAND">Terrain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select name="status" defaultValue={initialData?.status || "AVAILABLE"}>
                    <SelectTrigger id="status">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="AVAILABLE">Disponible</SelectItem>
                        <SelectItem value="RENTED">Occupé</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="images">Photos du bien</Label>
            {isEdit ? (
              <>
                <Input id="images" name="images" type="file" accept="image/*" />
                <p className="text-[11px] text-muted-foreground">
                  Format JPG, PNG ou WEBP. Max 2Mo par image. 1 image facultative.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: MIN_PROPERTY_IMAGES }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`image-${index + 1}`} className="text-xs text-secondary">
                      Photo {index + 1}
                    </Label>
                    <Input
                      id={`image-${index + 1}`}
                      name="images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Ajoutez 3 photos. Formats JPG, PNG ou WEBP. Max 2Mo par image.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="landDocuments">Documents fonciers</Label>
            {!isEdit ? (
              <>
                <Select name="landDocumentType" key={offerType} value={landDocumentType} onValueChange={setLandDocumentType}>
                  <SelectTrigger id="landDocumentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {landDocOptions.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="landDocuments"
                  name="landDocuments"
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  PDF ou image, max 5 Mo. Minimum {MIN_LAND_DOCUMENTS} document (titre, plan, etc.).
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Gerez les documents fonciers dans la section dediee ci-dessous.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initialData?.description ?? ''}
              placeholder="Description détaillée du bien..."
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800">
          <Button asChild variant="outline" disabled={loading}>
            <Link href={`${dashboardPath}/properties`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Traitement...' : isEdit ? 'Sauvegarder les modifications' : 'Créer le bien'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
