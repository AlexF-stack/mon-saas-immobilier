import fs from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const A_COMPLETER = 'A completer'

export type ContractWordData = {
  contractNumber: string
  contractType: 'RENTAL' | 'SALE'
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  ownerMomoNumber?: string | null
  tenantName: string
  tenantEmail: string
  tenantPhone: string
  propertyTitle: string
  propertyAddress: string
  propertyCity: string
  propertyType: string
  propertyDescription?: string | null
  startDate: Date
  endDate: Date
  rentAmount: number
  depositAmount: number
  clauses: string
  ownerSignedAt?: Date | null
  tenantSignedAt?: Date | null
}

export type ReceiptWordData = {
  receiptNumber: string
  contractNumber: string
  tenantName: string
  ownerName: string
  propertyTitle: string
  propertyAddress: string
  paymentDate: Date
  amount: number
  method: string
  transactionId: string
  receiptMentions: string
}

function formatDateFr(value: Date) {
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatAmountFr(value: number) {
  return value.toLocaleString('fr-FR')
}

function formatPropertyType(value?: string | null) {
  switch (value) {
    case 'APARTMENT':
      return 'Appartement'
    case 'HOUSE':
      return 'Maison / Villa'
    case 'STUDIO':
      return 'Studio'
    case 'COMMERCIAL':
      return 'Local commercial'
    case 'LAND':
      return 'Terrain'
    default:
      return value || A_COMPLETER
  }
}

function signatureLabel(date?: Date | null) {
  return date ? formatDateFr(date) : 'En attente de signature'
}

function monthsBetween(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  const diffDays = Math.max(0, Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000)))
  return Math.max(1, Math.round(diffDays / 30))
}

function depositMonths(rentAmount: number, depositAmount: number) {
  if (rentAmount <= 0) return '1'
  return String(Math.max(1, Math.round(depositAmount / rentAmount)))
}

function buildPaymentModeLabel(momoNumber?: string | null) {
  if (momoNumber?.trim()) {
    return `Mobile Money (numero : ${momoNumber.trim()}) — ou virement bancaire selon accord.`
  }
  return 'Par virement bancaire ou Mobile Money (coordonnees communiquees par le bailleur).'
}

export function buildContractWordPayload(data: ContractWordData): Record<string, string> {
  const dureeMois = monthsBetween(data.startDate, data.endDate)
  const bienAdresse = [data.propertyAddress, data.propertyCity].filter(Boolean).join(', ')
  const clauses =
    data.clauses?.trim() ||
    'Aucune clause complementaire. Les dispositions legales du present contrat s appliquent.'

  return {
    contractNumber: data.contractNumber,
    documentDate: formatDateFr(new Date()),

    bailleurNom: data.ownerName,
    bailleurNaissance: A_COMPLETER,
    bailleurNationalite: A_COMPLETER,
    bailleurProfession: A_COMPLETER,
    bailleurAdresse: data.propertyCity ? `${data.propertyCity} (Benin)` : A_COMPLETER,
    bailleurPieceIdentite: A_COMPLETER,
    bailleurEmail: data.ownerEmail || A_COMPLETER,
    bailleurTelephone: data.ownerPhone || A_COMPLETER,

    locataireNom: data.tenantName,
    locataireNaissance: A_COMPLETER,
    locataireNationalite: A_COMPLETER,
    locataireProfession: A_COMPLETER,
    locataireAdresse: bienAdresse || A_COMPLETER,
    locatairePieceIdentite: A_COMPLETER,
    locataireTelephone: data.tenantPhone || A_COMPLETER,
    locataireEmail: data.tenantEmail || A_COMPLETER,

    bienAdresse: bienAdresse || A_COMPLETER,
    bienTitre: data.propertyTitle || A_COMPLETER,
    bienType: formatPropertyType(data.propertyType),
    bienPieces: A_COMPLETER,
    bienSurface: A_COMPLETER,
    bienEtage: A_COMPLETER,
    bienUsage: 'habitation',

    dureeMois: String(dureeMois),
    dureeMoisChiffre: String(dureeMois),
    dateEffet: formatDateFr(data.startDate),
    dateFin: formatDateFr(data.endDate),

    loyerMontant: formatAmountFr(data.rentAmount),
    loyerMontantChiffres: formatAmountFr(data.rentAmount),
    termePaiement: 'A terme echu (fin du mois)',
    modePaiement: buildPaymentModeLabel(data.ownerMomoNumber),
    penaliteRetard: '10',

    cautionMontant: formatAmountFr(data.depositAmount),
    cautionMontantChiffres: formatAmountFr(data.depositAmount),
    cautionMois: depositMonths(data.rentAmount, data.depositAmount),

    preavisMois: '3',

    lieuSignature: data.propertyCity || 'Cotonou',
    dateSignature: formatDateFr(new Date()),
    signatureBailleur: data.ownerSignedAt ? 'Signe' : A_COMPLETER,
    dateSignatureBailleur: signatureLabel(data.ownerSignedAt),
    signatureLocataire: data.tenantSignedAt ? 'Signe' : A_COMPLETER,
    dateSignatureLocataire: signatureLabel(data.tenantSignedAt),

    clauses,

    // Alias legacy (contrat-vente / anciennes balises)
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail || A_COMPLETER,
    ownerPhone: data.ownerPhone || A_COMPLETER,
    tenantName: data.tenantName,
    tenantEmail: data.tenantEmail || A_COMPLETER,
    tenantPhone: data.tenantPhone || A_COMPLETER,
    propertyTitle: data.propertyTitle,
    propertyAddress: data.propertyAddress,
    propertyCity: data.propertyCity || A_COMPLETER,
    propertyType: formatPropertyType(data.propertyType),
    startDate: formatDateFr(data.startDate),
    endDate: formatDateFr(data.endDate),
    rentAmount: formatAmountFr(data.rentAmount),
    depositAmount: formatAmountFr(data.depositAmount),
    ownerSignatureDate: signatureLabel(data.ownerSignedAt),
    tenantSignatureDate: signatureLabel(data.tenantSignedAt),
  }
}

export function buildReceiptWordPayload(data: ReceiptWordData): Record<string, string> {
  return {
    receiptNumber: data.receiptNumber,
    contractNumber: data.contractNumber || A_COMPLETER,
    documentDate: formatDateFr(new Date()),
    paymentDate: formatDateFr(data.paymentDate),
    tenantName: data.tenantName,
    ownerName: data.ownerName,
    propertyTitle: data.propertyTitle,
    propertyAddress: data.propertyAddress,
    amount: formatAmountFr(data.amount),
    method: data.method,
    transactionId: data.transactionId,
    receiptMentions: data.receiptMentions?.trim() || 'Paiement recu et constate.',
  }
}

/** Resume pour le workflow applicatif (soumission / signature). */
export function buildContractPlainTextFromTemplate(data: ContractWordData): string {
  const p = buildContractWordPayload(data)
  if (data.contractType === 'SALE') {
    return [
      'CONTRAT DE VENTE IMMOBILIERE',
      `Numero : ${p.contractNumber}`,
      `Vendeur : ${p.bailleurNom}`,
      `Acheteur : ${p.locataireNom}`,
      `Bien : ${p.bienTitre} — ${p.bienAdresse}`,
      `Montant : ${p.loyerMontant} FCFA`,
      `Conditions : ${p.clauses}`,
    ].join('\n')
  }

  return [
    "CONTRAT DE BAIL D'HABITATION — Republique du Benin",
    `Numero de dossier : ${p.contractNumber}`,
    '',
    'Article 1 — Parties',
    `Bailleur : ${p.bailleurNom} | ${p.bailleurEmail} | ${p.bailleurTelephone}`,
    `Locataire : ${p.locataireNom} | ${p.locataireEmail} | ${p.locataireTelephone}`,
    '',
    'Article 2 — Bien',
    `${p.bienTitre} — ${p.bienAdresse} (${p.bienType})`,
    '',
    'Article 3 — Duree',
    `${p.dureeMois} mois du ${p.dateEffet} au ${p.dateFin}`,
    '',
    'Article 4 — Loyer',
    `${p.loyerMontant} FCFA / mois — ${p.modePaiement}`,
    '',
    'Article 5 — Caution',
    `${p.cautionMontant} FCFA (${p.cautionMois} mois de loyer)`,
    '',
    'Clauses complementaires :',
    p.clauses,
    '',
    'Document Word complet disponible au telechargement (.docx).',
  ].join('\n')
}

async function readTemplateBuffer(templateFileName: string): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'templates', templateFileName)
  return await fs.readFile(templatePath)
}

export async function templateExists(templateFileName: string): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), 'templates', templateFileName))
    return true
  } catch {
    return false
  }
}

export async function renderWordTemplate(
  templateFileName: string,
  payload: Record<string, string>
): Promise<Buffer> {
  const content = await readTemplateBuffer(templateFileName)
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })
  doc.render(payload)
  const output = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })
  return Buffer.from(output)
}

export async function renderContractWordDocument(data: ContractWordData): Promise<Buffer> {
  const templateName = data.contractType === 'SALE' ? 'contrat-vente.docx' : 'contrat-location.docx'
  return await renderWordTemplate(templateName, buildContractWordPayload(data))
}

export async function renderReceiptWordDocument(data: ReceiptWordData): Promise<Buffer> {
  return await renderWordTemplate('quittance-loyer.docx', buildReceiptWordPayload(data))
}

type ContractRecordForWord = {
  contractNumber: string
  contractType: string
  startDate: Date
  endDate: Date
  rentAmount: number
  depositAmount: number
  contractText: string | null
  rentalTermsSnapshot: string | null
  ownerSignedAt?: Date | null
  tenantSignedAt?: Date | null
  property: {
    title: string
    address: string
    city: string | null
    propertyType: string
    description?: string | null
    manager?: {
      name: string | null
      email: string | null
      phone: string | null
      paymentMomoNumber?: string | null
    } | null
  }
  tenant: {
    name: string | null
    email: string
    phone: string | null
  }
}

export function mapContractRecordToWordData(contract: ContractRecordForWord): ContractWordData {
  const manager = contract.property.manager
  return {
    contractNumber: contract.contractNumber,
    contractType: contract.contractType === 'SALE' ? 'SALE' : 'RENTAL',
    ownerName: manager?.name || manager?.email || 'Bailleur',
    ownerEmail: manager?.email || '',
    ownerPhone: manager?.phone || '',
    ownerMomoNumber: manager?.paymentMomoNumber,
    tenantName: contract.tenant.name || contract.tenant.email,
    tenantEmail: contract.tenant.email,
    tenantPhone: contract.tenant.phone || '',
    propertyTitle: contract.property.title,
    propertyAddress: contract.property.address,
    propertyCity: contract.property.city || '',
    propertyType: contract.property.propertyType,
    propertyDescription: contract.property.description,
    startDate: contract.startDate,
    endDate: contract.endDate,
    rentAmount: contract.rentAmount,
    depositAmount: contract.depositAmount,
    clauses: contract.contractText || contract.rentalTermsSnapshot || '',
    ownerSignedAt: contract.ownerSignedAt,
    tenantSignedAt: contract.tenantSignedAt,
  }
}
