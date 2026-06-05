/**
 * Génère les modèles Word (.docx) avec balises docxtemplater {champ}.
 * Exécuter : node scripts/generate-word-templates.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import PizZip from 'pizzip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templatesDir = path.join(__dirname, '..', 'templates')

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function createDocx(paragraphs) {
  const body =
    paragraphs.map((line) => paragraph(line)).join('') +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`

  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  )
  zip.file('word/document.xml', documentXml)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const contractRental = [
  'CONTRAT DE LOCATION',
  '',
  'Numero : {contractNumber}',
  'Date du document : {documentDate}',
  '',
  'ENTRE LES SOUSSIGNES',
  '',
  'Le proprietaire / gestionnaire : {ownerName}',
  'Email : {ownerEmail}',
  'Telephone : {ownerPhone}',
  '',
  'Le locataire : {tenantName}',
  'Email : {tenantEmail}',
  'Telephone : {tenantPhone}',
  '',
  'IL A ETE CONVENU CE QUI SUIT',
  '',
  'Article 1 - Objet',
  'Le proprietaire loue au locataire le bien suivant :',
  'Intitule : {propertyTitle}',
  'Adresse : {propertyAddress}',
  'Ville : {propertyCity}',
  'Type : {propertyType}',
  '',
  'Article 2 - Duree',
  'Du {startDate} au {endDate}.',
  '',
  'Article 3 - Loyer et caution',
  'Loyer mensuel : {rentAmount} FCFA',
  'Caution : {depositAmount} FCFA',
  '',
  'Article 4 - Conditions particulieres',
  '{clauses}',
  '',
  'Article 5 - Signatures',
  'Signature proprietaire : {ownerSignatureDate}',
  'Signature locataire : {tenantSignatureDate}',
]

const contractSale = [
  'CONTRAT DE VENTE IMMOBILIERE',
  '',
  'Numero : {contractNumber}',
  'Date du document : {documentDate}',
  '',
  'Vendeur / gestionnaire : {ownerName}',
  'Email : {ownerEmail}',
  '',
  'Acheteur : {tenantName}',
  'Email : {tenantEmail}',
  'Telephone : {tenantPhone}',
  '',
  'Bien : {propertyTitle}',
  'Adresse : {propertyAddress} - {propertyCity}',
  'Type : {propertyType}',
  '',
  'Prix de vente : {rentAmount} FCFA',
  'Acompte : {depositAmount} FCFA',
  'Periode : du {startDate} au {endDate}',
  '',
  'Conditions :',
  '{clauses}',
  '',
  'Signatures : proprietaire {ownerSignatureDate} / acheteur {tenantSignatureDate}',
]

const receipt = [
  'QUITTANCE DE LOYER',
  '',
  'Reference : {receiptNumber}',
  'Contrat : {contractNumber}',
  'Date de paiement : {paymentDate}',
  '',
  'Locataire : {tenantName}',
  'Proprietaire : {ownerName}',
  '',
  'Bien : {propertyTitle}',
  'Adresse : {propertyAddress}',
  '',
  'Montant paye : {amount} FCFA',
  'Mode de paiement : {method}',
  'Reference transaction : {transactionId}',
  '',
  'Mentions :',
  '{receiptMentions}',
  '',
  'Document emis le {documentDate}',
]

if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true })
}

fs.writeFileSync(path.join(templatesDir, 'contrat-location.docx'), createDocx(contractRental))
fs.writeFileSync(path.join(templatesDir, 'contrat-vente.docx'), createDocx(contractSale))
fs.writeFileSync(path.join(templatesDir, 'quittance-loyer.docx'), createDocx(receipt))

console.log('Modeles Word generes dans templates/')
