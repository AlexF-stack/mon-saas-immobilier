import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type MarketplacePropertyCardProps = {
    locale: string
    property: {
        id: string
        title: string
        city: string | null
        address: string
        description: string | null
        price: number
        status: string
        propertyType: string
        isPremium?: boolean
        images: { id: string; url: string }[]
    }
}

function propertyTypeLabel(propertyType: string) {
    if (propertyType === 'APARTMENT') return 'Appartement'
    if (propertyType === 'HOUSE') return 'Maison'
    if (propertyType === 'STUDIO') return 'Studio'
    if (propertyType === 'COMMERCIAL') return 'Commercial'
    return propertyType
}

export function MarketplacePropertyCard({ locale, property }: MarketplacePropertyCardProps) {
    const cover = property.images[0]?.url ?? null

    return (
        <Card className="overflow-hidden">
            <div className="h-44 w-full overflow-hidden bg-surface">
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={cover}
                        alt={property.title}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-[rgb(var(--card)/0.9)] text-secondary">
                        Image indisponible
                    </div>
                )}
            </div>
            <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-1 text-base">{property.title}</CardTitle>
                    <div className="flex items-center gap-1.5">
                        {property.isPremium ? <Badge variant="default">Premium</Badge> : null}
                        <Badge variant={property.status === 'AVAILABLE' ? 'success' : 'warning'}>
                            {property.status === 'AVAILABLE' ? 'Disponible' : property.status}
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-secondary">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="line-clamp-1">
                        {[property.city, property.address].filter(Boolean).join(', ')}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
                    {property.price.toLocaleString('fr-FR')} FCFA
                </p>
                <Badge variant="outline">{propertyTypeLabel(property.propertyType)}</Badge>
                <p className="line-clamp-2 text-sm text-secondary">
                    {property.description || 'Aucune description disponible.'}
                </p>
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={`/${locale}/marketplace/${property.id}`}>Voir le detail</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
