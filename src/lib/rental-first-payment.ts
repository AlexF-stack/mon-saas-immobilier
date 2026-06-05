/** Premier reglement locatif : depot de garantie + loyers d'avance a l'entree. */
export const RENT_ADVANCE_MONTHS_ON_ENTRY = 3

export function computeFirstInstallmentAmounts(rentAmount: number, depositAmount: number) {
  const advanceRent = rentAmount * RENT_ADVANCE_MONTHS_ON_ENTRY
  const totalDue = depositAmount + advanceRent
  return {
    depositAmount,
    advanceMonths: RENT_ADVANCE_MONTHS_ON_ENTRY,
    advanceRent,
    totalDue,
    baseAmount: totalDue,
  }
}

export function firstInstallmentLabel(): string {
  return `Caution + ${RENT_ADVANCE_MONTHS_ON_ENTRY} mois d'avance`
}

export function receiptBreakdownForFirstPayment(rentAmount: number, depositAmount: number) {
  const { advanceRent, depositAmount: caution } = computeFirstInstallmentAmounts(
    rentAmount,
    depositAmount
  )
  return {
    montantLoyer: advanceRent,
    montantCharges: 0,
    montantAutres: caution,
    autresLibelle: 'Caution / depot de garantie',
  }
}

export function installmentPaymentLabel(sequence: number): string | null {
  if (sequence === 1) return firstInstallmentLabel()
  return null
}
