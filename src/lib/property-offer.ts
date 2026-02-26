export type PropertyOfferType = 'RENT' | 'SALE'

const RENT_ALIASES = new Set(['RENT', 'RENTAL', 'LOCATION', 'LOCATIVE', 'LOUER'])
const SALE_ALIASES = new Set(['SALE', 'SELL', 'VENTE', 'VENDRE'])

export function isPropertyOfferType(value: string): value is PropertyOfferType {
  return value === 'RENT' || value === 'SALE'
}

export function normalizePropertyOfferType(
  input: string | null | undefined,
  fallback: PropertyOfferType | null = null
): PropertyOfferType | null {
  if (!input || input.trim() === '') return fallback

  const normalized = input
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (RENT_ALIASES.has(normalized)) return 'RENT'
  if (SALE_ALIASES.has(normalized)) return 'SALE'
  return null
}

export function getOfferTypeLabel(offerType: string, locale: 'fr' | 'en' = 'fr'): string {
  if (locale === 'en') {
    return offerType === 'SALE' ? 'For sale' : 'For rent'
  }
  return offerType === 'SALE' ? 'A vendre' : 'A louer'
}
