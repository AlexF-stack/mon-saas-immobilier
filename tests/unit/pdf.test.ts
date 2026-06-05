import assert from 'node:assert/strict'
import { test } from 'node:test'

const { PDFParse } = require('pdf-parse')

import { generateContractPdf, generatePaymentReceiptPdf } from '../../src/lib/pdf'

function isPdf(buffer: Uint8Array) {
  return Buffer.from(buffer.slice(0, 5)).toString('hex') === '255044462d'
}

async function extractText(pdfBytes: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(pdfBytes) })
  const result = await parser.getText()
  return result.text
}

test('generateContractPdf returns a valid PDF with contract fields', async () => {
  const pdfBytes = await generateContractPdf({
    ownerName: 'Agence Immo SaaS',
    ownerEmail: 'contact@example.com',
    tenantName: 'Amidou',
    tenantEmail: 'tenant@example.com',
    tenantPhone: '+229 97 00 00 00',
    propertyTitle: 'Villa Centre',
    propertyAddress: '12 rue des Pins',
    propertyCity: 'Cotonou',
    propertyType: 'APARTMENT',
    contractNumber: 'CTR-2026-001',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    rentAmount: 180000,
    depositAmount: 180000,
    contractType: 'RENTAL',
    contractText: 'Clause de paiement mensuel et entretien.',
    ownerSignedAt: new Date('2026-01-01'),
    tenantSignedAt: new Date('2026-01-02'),
  })

  assert.equal(isPdf(pdfBytes), true)

  const text = await extractText(pdfBytes)
  assert.match(text, /Agence Immo SaaS/)
  assert.match(text, /Amidou/)
  assert.match(text, /Villa Centre/)
  assert.match(text, /180 000/)
})

test('generatePaymentReceiptPdf returns a valid PDF with receipt fields', async () => {
  const pdfBytes = await generatePaymentReceiptPdf({
    receiptNumber: 'RCP-TEST',
    tenantName: 'Amidou',
    ownerName: 'Agence Immo SaaS',
    propertyTitle: 'Villa Centre',
    propertyAddress: '12 rue des Pins',
    paymentDate: new Date('2026-06-04'),
    amount: 180000,
    method: 'MTN Mobile Money',
    transactionId: 'TXN-001',
    contractNumber: 'CTR-2026-001',
    receiptText: 'Paiement du loyer du mois de juin.',
  })

  assert.equal(isPdf(pdfBytes), true)

  const text = await extractText(pdfBytes)
  assert.match(text, /RCP-TEST/)
  assert.match(text, /MTN Mobile Money/)
  assert.match(text, /180 000/)
  assert.match(text, /Villa Centre/)
})
