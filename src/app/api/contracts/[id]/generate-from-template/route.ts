import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import {
  buildContractPlainTextFromTemplate,
  mapContractRecordToWordData,
  renderContractWordDocument,
  templateExists,
} from '@/lib/word-documents'
import { buildSnapshot, validateOwnerPartyProfile } from '@/lib/party-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                paymentMomoNumber: true,
              },
            },
          },
        },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (!canManageProperty(user, contract.property.managerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const templateOk = await templateExists(
      contract.contractType === 'SALE' ? 'contrat-vente.docx' : 'contrat-location.docx'
    )
    if (!templateOk) {
      return NextResponse.json(
        { error: 'Modele Word introuvable. Executez node scripts/generate-word-templates.mjs' },
        { status: 503 }
      )
    }

    if (contract.contractType === 'RENTAL') {
      const missing = validateOwnerPartyProfile(buildSnapshot(contract), {
        name: contract.property.manager?.name,
        phone: contract.property.manager?.phone,
        email: contract.property.manager?.email,
      })
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `Completez d abord les informations bailleur et bien (Article 1 et 2) : ${missing.join(', ')}`,
            missingFields: missing,
          },
          { status: 409 }
        )
      }
    }

    const wordData = mapContractRecordToWordData(contract)
    const contractText = buildContractPlainTextFromTemplate(wordData)

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        contractText,
        documentSource: 'DRAFT',
        rentalTermsSnapshot: contract.rentalTermsSnapshot || contractText.slice(0, 5000),
        workflowState: 'DRAFT',
        submittedAt: null,
        ownerSignedAt: null,
        tenantSignedAt: null,
      },
    })

    await renderContractWordDocument(wordData)

    return NextResponse.json({
      contract: updated,
      message: 'Contrat pre-rempli depuis le modele Word.',
      downloadUrl: `/api/contracts/${contract.id}/download?format=docx`,
    })
  } catch (error) {
    console.error('Generate contract from template error', error)
    return NextResponse.json(
      { error: 'Impossible de generer le document depuis le modele Word.' },
      { status: 500 }
    )
  }
}
