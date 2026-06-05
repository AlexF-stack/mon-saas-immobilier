import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface ContractData {
  ownerName: string
  ownerEmail?: string | null
  tenantName: string
  tenantEmail?: string | null
  tenantPhone?: string | null
  propertyTitle?: string | null
  propertyAddress: string
  propertyCity?: string | null
  propertyType?: string | null
  startDate: Date
  endDate: Date
  rentAmount: number
  depositAmount: number
  contractType?: 'RENTAL' | 'SALE'
  contractNumber?: string | null
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
  contractNumber?: string | null
  receiptText?: string | null
}

function normalizePdfText(value: string) {
  return value
    .replace(/\u202F/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
}

function formatPropertyType(value?: string | null) {
  switch (value) {
    case 'APARTMENT':
      return 'Appartement'
    case 'HOUSE':
      return 'Maison'
    case 'STUDIO':
      return 'Studio'
    case 'COMMERCIAL':
      return 'Commercial'
    case 'LAND':
      return 'Terrain'
    default:
      return value || 'Non précisé'
  }
}

function wrapPdfLine(text: string, maxLength = 95) {
  const normalized = normalizePdfText(text)
  if (normalized.length <= maxLength) return [normalized]

  const words = normalized.split(/(\s+)/).filter(Boolean)
  const wrapped: string[] = []
  let current = ''

  for (const word of words) {
    if ((current + word).length > maxLength && current) {
      wrapped.push(current.trim())
      current = word
    } else {
      current += word
    }
  }

  if (current.trim()) wrapped.push(current.trim())
  return wrapped
}

function drawLines(page: ReturnType<PDFDocument['addPage']>, lines: string[], font: Awaited<ReturnType<PDFDocument['embedFont']>>, startY: number, margin = 50, fontSize = 12) {
  let y = startY
  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim()) {
      y -= 18
      continue
    }

    for (const line of wrapPdfLine(rawLine)) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
      y -= 18
    }
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
    `Numéro du contrat : ${data.contractNumber || 'À renseigner'}`,
    `Type de contrat : ${isSale ? 'Vente immobilière' : 'Location'}`,
    '',
    '1. PARTIES CONTRACTANTES',
    `Propriétaire / Gestionnaire : ${data.ownerName}`,
    data.ownerEmail ? `Email propriétaire : ${data.ownerEmail}` : 'Email propriétaire : non renseigné',
    `${counterpartLabel} : ${data.tenantName}`,
    data.tenantEmail ? `Email ${isSale ? 'acheteur' : 'locataire'} : ${data.tenantEmail}` : `Email ${isSale ? 'acheteur' : 'locataire'} : non renseigné`,
    data.tenantPhone ? `Téléphone : ${data.tenantPhone}` : 'Téléphone : non renseigné',
    '',
    '2. OBJET DU CONTRAT',
    `Bien : ${data.propertyTitle || data.propertyAddress}`,
    `Adresse : ${data.propertyAddress}`,
    data.propertyCity ? `Ville : ${data.propertyCity}` : 'Ville : non renseignée',
    `Type de bien : ${formatPropertyType(data.propertyType)}`,
    '',
    '3. DURÉE ET MONTANTS',
    `Période contractuelle : du ${data.startDate.toLocaleDateString('fr-FR')} au ${data.endDate.toLocaleDateString('fr-FR')}`,
    `${amountLabel} : ${data.rentAmount.toLocaleString('fr-FR')} FCFA`,
    `${depositLabel} : ${data.depositAmount.toLocaleString('fr-FR')} FCFA`,
    '',
    '4. CLAUSES ET MENTIONS',
  ]

  if (data.contractText && data.contractText.trim()) {
    lines.push(data.contractText.trim())
  } else {
    lines.push('Les clauses et conditions spécifiques seront ajoutées selon les informations saisies dans l’interface de gestion.')
  }

  lines.push('')
  lines.push('5. SIGNATURES')
  lines.push(data.ownerSignedAt ? `Signature propriétaire : ${data.ownerSignedAt.toLocaleDateString('fr-FR')}` : 'Signature propriétaire : en attente')
  lines.push(
    data.tenantSignedAt
      ? `Signature ${isSale ? 'acheteur' : 'locataire'} : ${data.tenantSignedAt.toLocaleDateString('fr-FR')}`
      : `Signature ${isSale ? 'acheteur' : 'locataire'} : en attente`
  )
  lines.push('')
  lines.push(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`)

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
    'QUITTANCE DE LOYER / REÇU DE PAIEMENT',
    '',
    `Référence : ${data.receiptNumber}`,
    data.contractNumber ? `Contrat : ${data.contractNumber}` : 'Contrat : non renseigné',
    `Date de paiement : ${data.paymentDate.toLocaleDateString('fr-FR')}`,
    '',
    `Locataire / Acheteur : ${data.tenantName}`,
    `Propriétaire / Gestionnaire : ${data.ownerName}`,
    '',
    `Bien : ${data.propertyTitle}`,
    `Adresse : ${data.propertyAddress}`,
    '',
    `Montant payé : ${data.amount.toLocaleString('fr-FR')} FCFA`,
    `Méthode de paiement : ${data.method}`,
    `Transaction / Référence opérateur : ${data.transactionId}`,
    '',
  ]

  if (data.receiptText && data.receiptText.trim()) {
    lines.push('Mentions complémentaires :')
    lines.push(data.receiptText.trim())
    lines.push('')
  }

  lines.push('Ce document sert de preuve de paiement et peut être présenté en cas de contrôle.')
  lines.push(`Émis le ${new Date().toLocaleDateString('fr-FR')}`)

  drawLines(page, lines, font, height - margin - 40)
  return await pdfDoc.save()
}
