import fs from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export type ContractWordData = {
  contractNumber: string
  contractType: 'RENTAL' | 'SALE'
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  tenantName: string
  tenantEmail: string
  tenantPhone: string
  propertyTitle: string
  propertyAddress: string
  propertyCity: string
  propertyType: string
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
      return 'Maison'
    case 'STUDIO':
      return 'Studio'
    case 'COMMERCIAL':
      return 'Commercial'
    case 'LAND':
      return 'Terrain'
    default:
      return value || 'Non precise'
  }
}

function signatureLabel(date?: Date | null) {
  return date ? formatDateFr(date) : 'En attente'
}

export function buildContractWordPayload(data: ContractWordData): Record<string, string> {
  return {
    contractNumber: data.contractNumber,
    documentDate: formatDateFr(new Date()),
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail || 'Non renseigne',
    ownerPhone: data.ownerPhone || 'Non renseigne',
    tenantName: data.tenantName,
    tenantEmail: data.tenantEmail || 'Non renseigne',
    tenantPhone: data.tenantPhone || 'Non renseigne',
    propertyTitle: data.propertyTitle,
    propertyAddress: data.propertyAddress,
    propertyCity: data.propertyCity || 'Non renseignee',
    propertyType: formatPropertyType(data.propertyType),
    startDate: formatDateFr(data.startDate),
    endDate: formatDateFr(data.endDate),
    rentAmount: formatAmountFr(data.rentAmount),
    depositAmount: formatAmountFr(data.depositAmount),
    clauses: data.clauses?.trim() || 'Voir conditions enregistrees dans le dossier.',
    ownerSignatureDate: signatureLabel(data.ownerSignedAt),
    tenantSignatureDate: signatureLabel(data.tenantSignedAt),
  }
}

export function buildReceiptWordPayload(data: ReceiptWordData): Record<string, string> {
  return {
    receiptNumber: data.receiptNumber,
    contractNumber: data.contractNumber || 'Non renseigne',
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

/** Texte plat pour le workflow (soumission / signature) aligne sur le modele Word. */
export function buildContractPlainTextFromTemplate(data: ContractWordData): string {
  const payload = buildContractWordPayload(data)
  const isSale = data.contractType === 'SALE'
  const title = isSale ? 'CONTRAT DE VENTE IMMOBILIERE' : 'CONTRAT DE LOCATION'

  return [
    title,
    `Numero : ${payload.contractNumber}`,
    '',
    `Proprietaire : ${payload.ownerName} (${payload.ownerEmail})`,
    `${isSale ? 'Acheteur' : 'Locataire'} : ${payload.tenantName} (${payload.tenantEmail})`,
    '',
    `Bien : ${payload.propertyTitle}`,
    `Adresse : ${payload.propertyAddress}, ${payload.propertyCity}`,
    `Periode : du ${payload.startDate} au ${payload.endDate}`,
    `${isSale ? 'Prix' : 'Loyer'} : ${payload.rentAmount} FCFA`,
    `Caution / acompte : ${payload.depositAmount} FCFA`,
    '',
    'Conditions :',
    payload.clauses,
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
