import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateOwnerPartyProfile,
  validateTenantPartyProfile,
  type ContractPartySnapshot,
} from '../../src/lib/party-profile'

const emptySnapshot = (): ContractPartySnapshot => ({
  ownerBirthDate: null,
  ownerBirthPlace: null,
  ownerNationality: null,
  ownerProfession: null,
  ownerIdDocumentNumber: null,
  ownerAddress: null,
  tenantBirthDate: null,
  tenantBirthPlace: null,
  tenantNationality: null,
  tenantProfession: null,
  tenantIdDocumentNumber: null,
  tenantAddress: null,
  propertyRoomCount: null,
  propertySurfaceSqm: null,
  propertyFloor: null,
  ownerPartyCompletedAt: null,
  tenantPartyCompletedAt: null,
})

test('validateOwnerPartyProfile exige contact et bien (Article 1 et 2)', () => {
  const missing = validateOwnerPartyProfile(emptySnapshot(), {
    name: null,
    phone: null,
    email: null,
  })
  assert.ok(missing.includes('Nom et prenom du bailleur'))
  assert.ok(missing.includes('Telephone du bailleur'))
  assert.ok(missing.includes('Nombre de pieces du bien'))
})

test('validateTenantPartyProfile aligne locataire sur Article 1', () => {
  const snapshot: ContractPartySnapshot = {
    ...emptySnapshot(),
    tenantBirthDate: new Date('1990-01-15'),
    tenantBirthPlace: 'Cotonou',
    tenantNationality: 'Beninoise',
    tenantProfession: 'Commercant',
    tenantIdDocumentNumber: 'CNI123',
    tenantAddress: 'Rue 12',
  }
  const missing = validateTenantPartyProfile(snapshot, {
    name: 'Jean Dupont',
    phone: '+22997000001',
    email: 'jean@test.com',
  })
  assert.equal(missing.length, 0)
})
