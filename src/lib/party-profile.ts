export type PartyProfileInput = {
  name?: string | null
  phone?: string | null
  birthDate?: string | null
  birthPlace?: string | null
  nationality?: string | null
  profession?: string | null
  idDocumentNumber?: string | null
  currentAddress?: string | null
}

export type PropertyDetailsInput = {
  roomCount?: number | null
  surfaceSqm?: number | null
  floor?: string | null
}

export type PartyContactInfo = {
  name?: string | null
  phone?: string | null
  email?: string | null
}

export type ContractPartySnapshot = {
  ownerBirthDate: Date | null
  ownerBirthPlace: string | null
  ownerNationality: string | null
  ownerProfession: string | null
  ownerIdDocumentNumber: string | null
  ownerAddress: string | null
  tenantBirthDate: Date | null
  tenantBirthPlace: string | null
  tenantNationality: string | null
  tenantProfession: string | null
  tenantIdDocumentNumber: string | null
  tenantAddress: string | null
  propertyRoomCount: number | null
  propertySurfaceSqm: number | null
  propertyFloor: string | null
  ownerPartyCompletedAt: Date | null
  tenantPartyCompletedAt: Date | null
}

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function isDateFilled(value: Date | null | undefined) {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function validatePartyIdentity(
  role: 'owner' | 'tenant',
  snapshot: ContractPartySnapshot,
  contact: PartyContactInfo
): string[] {
  const missing: string[] = []
  const who = role === 'owner' ? 'bailleur' : 'locataire'

  if (!isFilled(contact.name)) missing.push(`Nom et prenom du ${who}`)
  if (!isFilled(contact.phone)) missing.push(`Telephone du ${who}`)
  if (!isFilled(contact.email)) missing.push(`Email du ${who}`)

  const birthDate = role === 'owner' ? snapshot.ownerBirthDate : snapshot.tenantBirthDate
  const birthPlace = role === 'owner' ? snapshot.ownerBirthPlace : snapshot.tenantBirthPlace
  const nationality = role === 'owner' ? snapshot.ownerNationality : snapshot.tenantNationality
  const profession = role === 'owner' ? snapshot.ownerProfession : snapshot.tenantProfession
  const idDoc = role === 'owner' ? snapshot.ownerIdDocumentNumber : snapshot.tenantIdDocumentNumber
  const address = role === 'owner' ? snapshot.ownerAddress : snapshot.tenantAddress

  if (!isDateFilled(birthDate)) missing.push(`Date de naissance du ${who}`)
  if (!isFilled(birthPlace)) missing.push(`Lieu de naissance du ${who}`)
  if (!isFilled(nationality)) missing.push(`Nationalite du ${who}`)
  if (!isFilled(profession)) missing.push(`Profession du ${who}`)
  if (!isFilled(idDoc)) missing.push(`Piece d identite du ${who}`)
  if (!isFilled(address)) {
    missing.push(role === 'tenant' ? `Adresse actuelle du ${who}` : `Adresse du ${who}`)
  }

  return missing
}

function validatePropertyDetails(snapshot: ContractPartySnapshot): string[] {
  const missing: string[] = []
  if (snapshot.propertyRoomCount == null || snapshot.propertyRoomCount < 1) {
    missing.push('Nombre de pieces du bien')
  }
  if (snapshot.propertySurfaceSqm == null || snapshot.propertySurfaceSqm <= 0) {
    missing.push('Surface du bien (m²)')
  }
  if (!isFilled(snapshot.propertyFloor)) missing.push('Etage du bien')
  return missing
}

export function validateOwnerPartyProfile(
  snapshot: ContractPartySnapshot,
  contact: PartyContactInfo
): string[] {
  return [...validatePartyIdentity('owner', snapshot, contact), ...validatePropertyDetails(snapshot)]
}

export function validateTenantPartyProfile(
  snapshot: ContractPartySnapshot,
  contact: PartyContactInfo
): string[] {
  return validatePartyIdentity('tenant', snapshot, contact)
}

export function parseBirthDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatBirthDateForInput(value: Date | null | undefined): string {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

export function buildSnapshot(contract: ContractPartySnapshot): ContractPartySnapshot {
  return { ...contract }
}
