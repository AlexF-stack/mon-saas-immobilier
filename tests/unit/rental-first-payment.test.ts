import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeFirstInstallmentAmounts,
  firstInstallmentLabel,
  receiptBreakdownForFirstPayment,
  RENT_ADVANCE_MONTHS_ON_ENTRY,
} from '../../src/lib/rental-first-payment'

test('premier paiement = caution + 3 mois de loyer', () => {
  const amounts = computeFirstInstallmentAmounts(150_000, 150_000)
  assert.equal(amounts.advanceMonths, RENT_ADVANCE_MONTHS_ON_ENTRY)
  assert.equal(amounts.advanceRent, 450_000)
  assert.equal(amounts.totalDue, 600_000)
  assert.equal(firstInstallmentLabel(), 'Caution + 3 mois d\'avance')
})

test('quittance premier paiement ventile caution et avance', () => {
  const breakdown = receiptBreakdownForFirstPayment(150_000, 150_000)
  assert.equal(breakdown.montantLoyer, 450_000)
  assert.equal(breakdown.montantAutres, 150_000)
  assert.equal(breakdown.autresLibelle, 'Caution / depot de garantie')
})
