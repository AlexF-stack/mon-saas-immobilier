import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderContractWordDocument, templateExists } from '../../src/lib/word-documents'

test('word contract template exists and renders docx bytes', async () => {
  const exists = await templateExists('contrat-location.docx')
  assert.equal(exists, true)

  const buffer = await renderContractWordDocument({
    contractNumber: 'CTR-TEST-001',
    contractType: 'RENTAL',
    ownerName: 'Carl Manager',
    ownerEmail: 'manager@test.com',
    ownerPhone: '+22997000000',
    tenantName: 'Franky Preacher',
    tenantEmail: 'frankypreacher@gmail.com',
    tenantPhone: '+22997000001',
    propertyTitle: 'Appartement T3',
    propertyAddress: '12 rue des Palmiers',
    propertyCity: 'Cotonou',
    propertyType: 'APARTMENT',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    rentAmount: 150000,
    depositAmount: 150000,
    clauses: 'Paiement mensuel avant le 5 de chaque mois.',
  })

  assert.ok(buffer.length > 1000)
  assert.equal(buffer.subarray(0, 2).toString(), 'PK')
})
