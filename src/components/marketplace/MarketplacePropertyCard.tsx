'use client'

import { useEffect, useState, type PointerEvent } from 'react'
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

const REST_TRANSFORM = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'

export function MarketplacePropertyCard({ locale, property }: MarketplacePropertyCardProps) {
    const cover = property.images[0]?.url ?? null
    const [transform, setTransform] = useState(REST_TRANSFORM)
    const [glarePosition, setGlarePosition] = useState('50% 50%')
    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const apply = () => setReducedMotion(mediaQuery.matches)
        apply()
        mediaQuery.addEventListener('change', apply)
        return () => mediaQuery.removeEventListener('change', apply)
    }, [])

    function resetTilt() {
        setTransform(REST_TRANSFORM)
        setIsHovered(false)
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        if (reducedMotion || event.pointerType === 'touch') return

        const rect = event.currentTarget.getBoundingClientRect()
        const relativeX = (event.clientX - rect.left) / rect.width
        const relativeY = (event.clientY - rect.top) / rect.height

        const rotateY = (relativeX - 0.5) * 12
        const rotateX = (0.5 - relativeY) * 10

        setTransform(
            `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02,1.02,1.02)`
        )
        setGlarePosition(`${(relativeX * 100).toFixed(1)}% ${(relativeY * 100).toFixed(1)}%`)
        setIsHovered(true)
    }

    return (
        <div
            className="depth-wrapper relative animate-fade-up [transform-style:preserve-3d] transition-transform duration-200 will-change-transform"
            style={{ transform: reducedMotion ? undefined : transform }}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetTilt}
            onPointerUp={resetTilt}
        >
            <Card className="depth-layer glass-card overflow-hidden border border-border bg-card">
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
                    <Button asChild className="w-full" variant="cta">
                        <Link href={`/${locale}/marketplace/${property.id}`}>Voir le detail</Link>
                    </Button>
                </CardFooter>
            </Card>
            {!reducedMotion ? (
                <div
                    className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-200"
                    style={{
                        opacity: isHovered ? 0.25 : 0,
                        background: `radial-gradient(circle at ${glarePosition}, rgba(255,255,255,0.45), rgba(255,255,255,0) 45%)`,
                    }}
                    aria-hidden
                />
            ) : null}
        </div>
    )
}
