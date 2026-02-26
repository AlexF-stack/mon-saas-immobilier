import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface ContractData {
  ownerName: string
  tenantName: string
  propertyAddress: string
  startDate: Date
  endDate: Date
  rentAmount: number
  depositAmount: number
  contractType?: 'RENTAL' | 'SALE'
  contractText?: string | null
  ownerSignedAt?: Date | null
  tenantSignedAt?: Date | null
}

interface PaymentReceiptData {
  receiptNumber: string
  tenantName: string
  ownerName: string
  propertyTitle: string
  propertyAddress: string
  paymentDate: Date
  amount: number
  method: string
  transactionId: string
  receiptText?: string | null
}

function drawLines(page: ReturnType<PDFDocument['addPage']>, lines: string[], font: Awaited<ReturnType<PDFDocument['embedFont']>>, startY: number, margin = 50, fontSize = 12) {
  let y = startY
  for (const line of lines) {
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
    y -= 20
  }
}

export async function generateContractPdf(data: ContractData) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const margin = 50
  const titleSize = 20
  const isSale = data.contractType === 'SALE'
  const title = isSale ? 'CONTRAT DE VENTE IMMOBILIERE' : 'CONTRAT DE LOCATION'
  const counterpartLabel = isSale ? "L'ACHETEUR" : 'LE LOCATAIRE'
  const amountLabel = isSale ? 'Prix de vente' : 'Loyer mensuel'
  const depositLabel = isSale ? 'Acompte initial' : 'Caution'

  page.drawText(title, {
    x: margin,
    y: height - margin,
    size: titleSize,
    font,
    color: rgb(0, 0, 0),
  })

  const lines: string[] = [
    '',
    'ENTRE LES SOUSSIGNES :',
    '',
    `LE PROPRIETAIRE / GESTIONNAIRE : ${data.ownerName}`,
    `${counterpartLabel} : ${data.tenantName}`,
    '',
    "IL A ETE CONVENU CE QUI SUIT :",
    '',
    `Objet: ${isSale ? 'Vente' : 'Location'} du bien situe a ${data.propertyAddress}`,
    `Periode contractuelle: du ${data.startDate.toLocaleDateString('fr-FR')} au ${data.endDate.toLocaleDateString('fr-FR')}`,
    '',
    `${amountLabel}: ${data.rentAmount.toLocaleString('fr-FR')} FCFA`,
    `${depositLabel}: ${data.depositAmount.toLocaleString('fr-FR')} FCFA`,
    '',
  ]

  if (data.contractText && data.contractText.trim()) {
    lines.push('Clauses redigees dans l application :')
    lines.push(data.contractText.trim())
    lines.push('')
  }

  lines.push(`Fait le ${new Date().toLocaleDateString('fr-FR')}`)
  lines.push('')
  lines.push('SIGNATURES :')
  lines.push(data.ownerSignedAt ? `Signature proprietaire: ${data.ownerSignedAt.toLocaleDateString('fr-FR')}` : 'Signature proprietaire: en attente')
  lines.push(
    data.tenantSignedAt
      ? `Signature ${isSale ? 'acheteur' : 'locataire'}: ${data.tenantSignedAt.toLocaleDateString('fr-FR')}`
      : `Signature ${isSale ? 'acheteur' : 'locataire'}: en attente`
  )

  drawLines(page, lines, font, height - margin - 40)
  return await pdfDoc.save()
}

export async function generatePaymentReceiptPdf(data: PaymentReceiptData) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const margin = 50
  const titleSize = 20

  page.drawText('QUITTANCE / RECU DE PAIEMENT', {
    x: margin,
    y: height - margin,
    size: titleSize,
    font,
    color: rgb(0, 0, 0),
  })

  const lines: string[] = [
    '',
    `Reference: ${data.receiptNumber}`,
    `Date paiement: ${data.paymentDate.toLocaleDateString('fr-FR')}`,
    '',
    `Locataire / Acheteur: ${data.tenantName}`,
    `Proprietaire: ${data.ownerName}`,
    '',
    `Bien: ${data.propertyTitle}`,
    `Adresse: ${data.propertyAddress}`,
    '',
    `Montant: ${data.amount.toLocaleString('fr-FR')} FCFA`,
    `Methode: ${data.method}`,
    `Transaction: ${data.transactionId}`,
    '',
  ]

  if (data.receiptText && data.receiptText.trim()) {
    lines.push('Mentions personnalisees :')
    lines.push(data.receiptText.trim())
    lines.push('')
  }

  lines.push("Ce document tient lieu de quittance de paiement.")
  lines.push(`Emis le ${new Date().toLocaleDateString('fr-FR')}`)

  drawLines(page, lines, font, height - margin - 40)
  return await pdfDoc.save()
}
