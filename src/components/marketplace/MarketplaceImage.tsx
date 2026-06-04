'use client'

import { useState } from 'react'

type MarketplaceImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  fallbackClassName?: string
  fallbackLabel?: string
}

export function MarketplaceImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = 'Image indisponible',
}: MarketplaceImageProps) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div
        className={
          fallbackClassName ??
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-[rgb(var(--card)/0.9)] text-sm text-secondary'
        }
      >
        {fallbackLabel}
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />
}
