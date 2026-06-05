import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  renderContractWordDocument,
  renderReceiptWordDocument,
  templateExists,
} from '../../src/lib/word-documents'

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

test('word receipt template exists and renders docx bytes', async () => {
  const exists = await templateExists('quittance-loyer.docx')
  assert.equal(exists, true)

  const paymentDate = new Date('2026-05-15')
  const buffer = await renderReceiptWordDocument({
    receiptNumber: 'RCP-20260515-ABC123',
    contractNumber: 'CTR-TEST-001',
    emissionDate: paymentDate,
    bailleurNom: 'Carl Manager',
    bailleurAdresse: 'Cotonou, Benin',
    bailleurTelephone: '+22997000000',
    locataireNom: 'Franky Preacher',
    locataireAdresse: '12 rue des Palmiers, Cotonou',
    locataireTelephone: '+22997000001',
    bienAdresse: '12 rue des Palmiers, Cotonou',
    bienType: 'Appartement',
    bienPieces: '3',
    montantLoyer: 150000,
    montantCharges: 0,
    montantAutres: 0,
    autresLibelle: '',
    montantTotal: 150000,
    periodeDebut: new Date('2026-05-01'),
    periodeFin: new Date('2026-05-31'),
    modePaiement: 'Mobile Money MTN',
    lieuSignature: 'Cotonou',
    paymentDate,
    transactionId: 'TX-TEST-001',
  })

  assert.ok(buffer.length > 1000)
  assert.equal(buffer.subarray(0, 2).toString(), 'PK')
})
