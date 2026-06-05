/**
 * Champs alignes sur l'Article 1 du CONTRAT DE BAIL D'HABITATION (Benin)
 * et sur les blocs BAILLEUR / LOCATAIRE de la quittance.
 */
export const RENTAL_PARTY_IDENTITY_FIELDS = {
  name: { label: 'Nom et prenom', contractArticle: 'Article 1' },
  birthDate: { label: 'Date de naissance', contractArticle: 'Article 1' },
  birthPlace: { label: 'Lieu de naissance', contractArticle: 'Article 1' },
  nationality: { label: 'Nationalite', contractArticle: 'Article 1' },
  profession: { label: 'Profession', contractArticle: 'Article 1' },
  currentAddress: {
    labelOwner: 'Adresse',
    labelTenant: 'Adresse actuelle',
    contractArticle: 'Article 1',
  },
  idDocumentNumber: {
    label: "Numero de piece d'identite (CNI / Passeport)",
    contractArticle: 'Article 1',
  },
  phone: { label: 'Numero de telephone', contractArticle: 'Article 1' },
  email: { label: 'Email', contractArticle: 'Article 1' },
} as const

export const RENTAL_PROPERTY_FIELDS = {
  roomCount: { label: 'Nombre de pieces', contractArticle: 'Article 2' },
  surfaceSqm: { label: 'Surface approximative (m²)', contractArticle: 'Article 2' },
  floor: { label: 'Etage', contractArticle: 'Article 2' },
} as const

export function partyAddressLabel(role: 'owner' | 'tenant') {
  return role === 'tenant'
    ? RENTAL_PARTY_IDENTITY_FIELDS.currentAddress.labelTenant
    : RENTAL_PARTY_IDENTITY_FIELDS.currentAddress.labelOwner
}
