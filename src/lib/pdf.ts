import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface ContractData {
    ownerName: string
    tenantName: string
    propertyAddress: string
    startDate: Date
    endDate: Date
    rentAmount: number
    depositAmount: number
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
}

export async function generateContractPdf(data: ContractData) {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()
    const { height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const fontSize = 12
    const titleSize = 24
    const margin = 50

    page.drawText('CONTRAT DE BAIL A USAGE D\'HABITATION', {
        x: margin,
        y: height - margin,
        size: titleSize,
        font,
        color: rgb(0, 0, 0), // Black
    })

    const formatedStartDate = data.startDate.toLocaleDateString('fr-FR')
    const formatedEndDate = data.endDate.toLocaleDateString('fr-FR')

    const textLines = [
        '',
        'ENTRE LES SOUSSIGNÉS :',
        '',
        `LE BAILLEUR (Propriétaire/Gérant) : ${data.ownerName}`,
        `LE LOCATAIRE : ${data.tenantName}`,
        '',
        'IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :',
        '',
        `OBJET DU CONTRAT : Location d'un bien immobilier situé à :`,
        `${data.propertyAddress}`,
        '',
        `DURÉE DU BAIL :`,
        `Le présent bail est consenti pour une durée déterminée allant du ${formatedStartDate}`,
        `au ${formatedEndDate}.`,
        '',
        `CONDITIONS FINANCIÈRES :`,
        `Loyer mensuel : ${data.rentAmount.toLocaleString('fr-FR')} FCFA`,
        `Caution (Dépôt de garantie) : ${data.depositAmount.toLocaleString('fr-FR')} FCFA`,
        '',
        `Fait à Cotonou, le ${new Date().toLocaleDateString('fr-FR')}`,
        '',
        'SIGNATURES :',
        '',
        '',
        'Le Bailleur                                          Le Locataire'
    ]

    let yPosition = height - margin - 50

    for (const line of textLines) {
        if (yPosition < 50) {
            // Add new page if out of space (not handled here simplified)
        }
        page.drawText(line, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font,
            lineHeight: 15,
        })
        yPosition -= 20
    }

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
}

export async function generatePaymentReceiptPdf(data: PaymentReceiptData) {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()
    const { height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const titleSize = 22
    const fontSize = 12
    const margin = 50

    page.drawText('QUITTANCE DE LOYER', {
        x: margin,
        y: height - margin,
        size: titleSize,
        font,
        color: rgb(0, 0, 0),
    })

    const lines = [
        '',
        `Reference: ${data.receiptNumber}`,
        `Date: ${data.paymentDate.toLocaleDateString('fr-FR')}`,
        '',
        `Locataire: ${data.tenantName}`,
        `Proprietaire/Gestionnaire: ${data.ownerName}`,
        '',
        `Bien: ${data.propertyTitle}`,
        `Adresse: ${data.propertyAddress}`,
        '',
        `Montant verse: ${data.amount.toLocaleString('fr-FR')} FCFA`,
        `Methode: ${data.method}`,
        `Transaction: ${data.transactionId}`,
        '',
        'Le present document tient lieu de quittance de paiement.',
        '',
        `Emission: ${new Date().toLocaleDateString('fr-FR')}`,
    ]

    let y = height - margin - 45
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

    return await pdfDoc.save()
}
