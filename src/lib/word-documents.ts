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
  ownerBirthDate?: Date | null
  ownerBirthPlace?: string | null
  ownerNationality?: string | null
  ownerProfession?: string | null
  ownerIdDocumentNumber?: string | null
  ownerAddress?: string | null
  tenantName: string
  tenantEmail: string
  tenantPhone: string
  tenantBirthDate?: Date | null
  tenantBirthPlace?: string | null
  tenantNationality?: string | null
  tenantProfession?: string | null
  tenantIdDocumentNumber?: string | null
  tenantAddress?: string | null
  propertyTitle: string
  propertyAddress: string
  propertyCity: string
  propertyType: string
  propertyDescription?: string | null
  propertyRoomCount?: number | null
  propertySurfaceSqm?: number | null
  propertyFloor?: string | null
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
  emissionDate: Date
  bailleurNom: string
  bailleurAdresse: string
  bailleurTelephone: string
  locataireNom: string
  locataireAdresse: string
  locataireTelephone: string
  bienAdresse: string
  bienType: string
  bienPieces: string
  montantLoyer: number
  montantCharges: number
  montantAutres: number
  autresLibelle: string
  montantTotal: number
  periodeDebut: Date
  periodeFin: Date
  modePaiement: string
  lieuSignature: string
  paymentDate: Date
  transactionId: string
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

function fieldOr(value: string | null | undefined, fallback = A_COMPLETER) {
  return value?.trim() ? value.trim() : fallback
}

function formatBirthLine(date?: Date | null, place?: string | null) {
  if (date && place?.trim()) {
    return `${formatDateFr(date)} a ${place.trim()}`
  }
  if (date) return formatDateFr(date)
  if (place?.trim()) return place.trim()
  return A_COMPLETER
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
    bailleurNaissance: formatBirthLine(data.ownerBirthDate, data.ownerBirthPlace),
    bailleurNationalite: fieldOr(data.ownerNationality),
    bailleurProfession: fieldOr(data.ownerProfession),
    bailleurAdresse: fieldOr(data.ownerAddress, data.propertyCity ? `${data.propertyCity} (Benin)` : A_COMPLETER),
    bailleurPieceIdentite: fieldOr(data.ownerIdDocumentNumber),
    bailleurEmail: data.ownerEmail || A_COMPLETER,
    bailleurTelephone: data.ownerPhone || A_COMPLETER,

    locataireNom: data.tenantName,
    locataireNaissance: formatBirthLine(data.tenantBirthDate, data.tenantBirthPlace),
    locataireNationalite: fieldOr(data.tenantNationality),
    locataireProfession: fieldOr(data.tenantProfession),
    locataireAdresse: fieldOr(data.tenantAddress, bienAdresse || A_COMPLETER),
    locatairePieceIdentite: fieldOr(data.tenantIdDocumentNumber),
    locataireTelephone: data.tenantPhone || A_COMPLETER,
    locataireEmail: data.tenantEmail || A_COMPLETER,

    bienAdresse: bienAdresse || A_COMPLETER,
    bienTitre: data.propertyTitle || A_COMPLETER,
    bienType: formatPropertyType(data.propertyType),
    bienPieces:
      data.propertyRoomCount != null ? String(data.propertyRoomCount) : A_COMPLETER,
    bienSurface:
      data.propertySurfaceSqm != null ? String(data.propertySurfaceSqm) : A_COMPLETER,
    bienEtage: fieldOr(data.propertyFloor),
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
    emissionDate: formatDateFr(data.emissionDate),
    documentDate: formatDateFr(new Date()),
    paymentDate: formatDateFr(data.paymentDate),
    bailleurNom: data.bailleurNom,
    bailleurAdresse: data.bailleurAdresse,
    bailleurTelephone: data.bailleurTelephone,
    locataireNom: data.locataireNom,
    locataireAdresse: data.locataireAdresse,
    locataireTelephone: data.locataireTelephone,
    bienAdresse: data.bienAdresse,
    bienType: data.bienType,
    bienPieces: data.bienPieces,
    montantLoyer: formatAmountFr(data.montantLoyer),
    montantCharges: formatAmountFr(data.montantCharges),
    montantAutres: formatAmountFr(data.montantAutres),
    autresLibelle: data.autresLibelle,
    montantTotal: formatAmountFr(data.montantTotal),
    periodeDebut: formatDateFr(data.periodeDebut),
    periodeFin: formatDateFr(data.periodeFin),
    modePaiement: data.modePaiement,
    lieuSignature: data.lieuSignature,
    dateSignatureBailleur: formatDateFr(data.paymentDate),
    dateSignatureLocataire: formatDateFr(data.paymentDate),
    ligneSignatureBailleur: '_______________________________',
    ligneSignatureLocataire: '_______________________________',
    tenantName: data.locataireNom,
    ownerName: data.bailleurNom,
    propertyTitle: data.bienAdresse,
    propertyAddress: data.bienAdresse,
    amount: formatAmountFr(data.montantTotal),
    method: data.modePaiement,
    transactionId: data.transactionId,
    receiptMentions: 'Paiement recu et constate.',
  }
}

export function monthPeriodAround(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start, end }
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
  ownerBirthDate?: Date | null
  ownerBirthPlace?: string | null
  ownerNationality?: string | null
  ownerProfession?: string | null
  ownerIdDocumentNumber?: string | null
  ownerAddress?: string | null
  tenantBirthDate?: Date | null
  tenantBirthPlace?: string | null
  tenantNationality?: string | null
  tenantProfession?: string | null
  tenantIdDocumentNumber?: string | null
  tenantAddress?: string | null
  propertyRoomCount?: number | null
  propertySurfaceSqm?: number | null
  propertyFloor?: string | null
  ownerSignedAt?: Date | null
  tenantSignedAt?: Date | null
  property: {
    title: string
    address: string
    city: string | null
    propertyType: string
    description?: string | null
    roomCount?: number | null
    surfaceSqm?: number | null
    floor?: string | null
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

function formatPaymentMethodLabel(method: string) {
  switch (method) {
    case 'MOMO_MTN':
      return 'Mobile Money MTN'
    case 'MOOV':
      return 'Mobile Money Moov'
    case 'CASH':
      return 'Especes'
    default:
      return method || A_COMPLETER
  }
}

type PaymentForReceipt = {
  amount: number
  method: string
  updatedAt: Date
  transactionId: string | null
  id: string
  type: string
}

export function mapPaymentToReceiptWordData(
  payment: PaymentForReceipt,
  contract: ContractRecordForWord,
  receiptNumber: string,
  emissionDate: Date
): ReceiptWordData {
  const wordContract = mapContractRecordToWordData(contract)
  const period = monthPeriodAround(payment.updatedAt)
  const rent = contract.rentAmount
  const isDeposit = payment.type === 'DEPOSIT'
  const montantLoyer = isDeposit ? 0 : Math.min(payment.amount, rent)
  const montantCharges = isDeposit ? 0 : Math.max(0, payment.amount - rent)
  const montantAutres = isDeposit ? payment.amount : 0
  const autresLibelle = isDeposit ? 'Caution / depot de garantie' : ''

  const bienAdresse = [contract.property.address, contract.property.city].filter(Boolean).join(', ')

  return {
    receiptNumber,
    contractNumber: contract.contractNumber,
    emissionDate,
    bailleurNom: wordContract.ownerName,
    bailleurAdresse: fieldOr(contract.ownerAddress ?? wordContract.ownerAddress),
    bailleurTelephone: wordContract.ownerPhone || A_COMPLETER,
    locataireNom: wordContract.tenantName,
    locataireAdresse: fieldOr(contract.tenantAddress ?? wordContract.tenantAddress),
    locataireTelephone: wordContract.tenantPhone || A_COMPLETER,
    bienAdresse: bienAdresse || A_COMPLETER,
    bienType: formatPropertyType(contract.property.propertyType),
    bienPieces:
      contract.propertyRoomCount != null
        ? String(contract.propertyRoomCount)
        : contract.property.roomCount != null
          ? String(contract.property.roomCount)
          : A_COMPLETER,
    montantLoyer,
    montantCharges,
    montantAutres,
    autresLibelle,
    montantTotal: payment.amount,
    periodeDebut: period.start,
    periodeFin: period.end,
    modePaiement: formatPaymentMethodLabel(payment.method),
    lieuSignature: contract.property.city || 'Cotonou',
    paymentDate: payment.updatedAt,
    transactionId: payment.transactionId ?? payment.id,
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
    ownerBirthDate: contract.ownerBirthDate,
    ownerBirthPlace: contract.ownerBirthPlace,
    ownerNationality: contract.ownerNationality,
    ownerProfession: contract.ownerProfession,
    ownerIdDocumentNumber: contract.ownerIdDocumentNumber,
    ownerAddress: contract.ownerAddress,
    tenantName: contract.tenant.name || contract.tenant.email,
    tenantEmail: contract.tenant.email,
    tenantPhone: contract.tenant.phone || '',
    tenantBirthDate: contract.tenantBirthDate,
    tenantBirthPlace: contract.tenantBirthPlace,
    tenantNationality: contract.tenantNationality,
    tenantProfession: contract.tenantProfession,
    tenantIdDocumentNumber: contract.tenantIdDocumentNumber,
    tenantAddress: contract.tenantAddress,
    propertyTitle: contract.property.title,
    propertyAddress: contract.property.address,
    propertyCity: contract.property.city || '',
    propertyType: contract.property.propertyType,
    propertyDescription: contract.property.description,
    propertyRoomCount: contract.propertyRoomCount ?? contract.property.roomCount,
    propertySurfaceSqm: contract.propertySurfaceSqm ?? contract.property.surfaceSqm,
    propertyFloor: contract.propertyFloor ?? contract.property.floor,
    startDate: contract.startDate,
    endDate: contract.endDate,
    rentAmount: contract.rentAmount,
    depositAmount: contract.depositAmount,
    clauses: contract.contractText || contract.rentalTermsSnapshot || '',
    ownerSignedAt: contract.ownerSignedAt,
    tenantSignedAt: contract.tenantSignedAt,
  }
}
