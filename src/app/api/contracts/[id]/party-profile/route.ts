import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canAccessContractScope, canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import {
  buildSnapshot,
  formatBirthDateForInput,
  parseBirthDate,
  validateOwnerPartyProfile,
  validateTenantPartyProfile,
  type ContractPartySnapshot,
  type PartyContactInfo,
} from '@/lib/party-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const partyFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional().nullable(),
  phone: z.string().trim().min(6).max(30).optional().nullable(),
  birthDate: z.string().trim().optional().nullable(),
  birthPlace: z.string().trim().max(120).optional().nullable(),
  nationality: z.string().trim().max(80).optional().nullable(),
  profession: z.string().trim().max(120).optional().nullable(),
  idDocumentNumber: z.string().trim().max(80).optional().nullable(),
  currentAddress: z.string().trim().max(300).optional().nullable(),
})

const patchSchema = z.object({
  role: z.enum(['owner', 'tenant']),
  party: partyFieldsSchema,
  property: z
    .object({
      roomCount: z.coerce.number().int().min(1).max(50).optional().nullable(),
      surfaceSqm: z.coerce.number().positive().max(10000).optional().nullable(),
      floor: z.string().trim().max(40).optional().nullable(),
    })
    .optional(),
})

const userIdentitySelect = {
  name: true,
  email: true,
  phone: true,
  birthDate: true,
  birthPlace: true,
  nationality: true,
  profession: true,
  idDocumentNumber: true,
  currentAddress: true,
} as const

function buildPartyResponse(
  snapshot: ContractPartySnapshot,
  role: 'owner' | 'tenant',
  user: {
    name: string | null
    email: string
    phone: string | null
    birthDate: Date | null
    birthPlace: string | null
    nationality: string | null
    profession: string | null
    idDocumentNumber: string | null
    currentAddress: string | null
  },
  contract: ContractPartySnapshot,
  missingFields: string[]
) {
  const isOwner = role === 'owner'
  return {
    name: user.name ?? '',
    phone: user.phone ?? '',
    email: user.email,
    birthDate: formatBirthDateForInput(
      (isOwner ? contract.ownerBirthDate : contract.tenantBirthDate) ?? user.birthDate
    ),
    birthPlace: (isOwner ? contract.ownerBirthPlace : contract.tenantBirthPlace) ?? user.birthPlace ?? '',
    nationality:
      (isOwner ? contract.ownerNationality : contract.tenantNationality) ?? user.nationality ?? '',
    profession: (isOwner ? contract.ownerProfession : contract.tenantProfession) ?? user.profession ?? '',
    idDocumentNumber:
      (isOwner ? contract.ownerIdDocumentNumber : contract.tenantIdDocumentNumber) ??
      user.idDocumentNumber ??
      '',
    currentAddress: (isOwner ? contract.ownerAddress : contract.tenantAddress) ?? user.currentAddress ?? '',
    completedAt: isOwner ? snapshot.ownerPartyCompletedAt : snapshot.tenantPartyCompletedAt,
    missingFields,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            managerId: true,
            roomCount: true,
            surfaceSqm: true,
            floor: true,
          },
        },
        tenant: { select: userIdentitySelect },
      },
    })

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (!canAccessContractScope(user, contract)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const manager = contract.property.managerId
      ? await prisma.user.findUnique({
          where: { id: contract.property.managerId },
          select: userIdentitySelect,
        })
      : null

    const snapshot = buildSnapshot(contract)
    const ownerContact: PartyContactInfo = {
      name: manager?.name,
      phone: manager?.phone,
      email: manager?.email,
    }
    const tenantContact: PartyContactInfo = {
      name: contract.tenant.name,
      phone: contract.tenant.phone,
      email: contract.tenant.email,
    }

    const ownerMissing = validateOwnerPartyProfile(snapshot, ownerContact)
    const tenantMissing = validateTenantPartyProfile(snapshot, tenantContact)

    const ownerUser = manager ?? {
      name: null,
      email: '',
      phone: null,
      birthDate: null,
      birthPlace: null,
      nationality: null,
      profession: null,
      idDocumentNumber: null,
      currentAddress: null,
    }

    return NextResponse.json({
      contractId: contract.id,
      contractType: contract.contractType,
      owner: buildPartyResponse(snapshot, 'owner', ownerUser, snapshot, ownerMissing),
      tenant: buildPartyResponse(snapshot, 'tenant', contract.tenant, snapshot, tenantMissing),
      property: {
        roomCount: contract.propertyRoomCount ?? contract.property.roomCount ?? '',
        surfaceSqm: contract.propertySurfaceSqm ?? contract.property.surfaceSqm ?? '',
        floor: contract.propertyFloor ?? contract.property.floor ?? '',
      },
      submittedAt: contract.submittedAt,
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
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
    const body = patchSchema.parse(await request.json())

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, managerId: true } },
        tenant: { select: userIdentitySelect },
      },
    })

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const canManage = canManageProperty(user, contract.property.managerId)
    const isTenant = user.role === 'TENANT' && contract.tenantId === user.id

    if (body.role === 'owner' && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (body.role === 'tenant' && !isTenant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (body.role === 'tenant' && contract.submittedAt == null) {
      return NextResponse.json(
        { error: 'Le contrat doit etre soumis par le bailleur avant de completer le profil locataire.' },
        { status: 409 }
      )
    }

    const birthDate = parseBirthDate(body.party.birthDate)
    const userPartyData = {
      name: body.party.name?.trim() || null,
      phone: body.party.phone?.trim() || null,
      birthDate,
      birthPlace: body.party.birthPlace?.trim() || null,
      nationality: body.party.nationality?.trim() || null,
      profession: body.party.profession?.trim() || null,
      idDocumentNumber: body.party.idDocumentNumber?.trim() || null,
      currentAddress: body.party.currentAddress?.trim() || null,
    }

    const contact: PartyContactInfo = {
      name: userPartyData.name ?? user.name,
      phone: userPartyData.phone ?? user.phone,
      email: user.email,
    }

    if (body.role === 'owner') {
      await prisma.user.update({
        where: { id: user.id },
        data: userPartyData,
      })

      if (body.property) {
        await prisma.property.update({
          where: { id: contract.property.id },
          data: {
            roomCount: body.property.roomCount ?? undefined,
            surfaceSqm: body.property.surfaceSqm ?? undefined,
            floor: body.property.floor?.trim() || null,
          },
        })
      }

      const draftSnapshot: ContractPartySnapshot = {
        ownerBirthDate: birthDate,
        ownerBirthPlace: userPartyData.birthPlace,
        ownerNationality: userPartyData.nationality,
        ownerProfession: userPartyData.profession,
        ownerIdDocumentNumber: userPartyData.idDocumentNumber,
        ownerAddress: userPartyData.currentAddress,
        tenantBirthDate: contract.tenantBirthDate,
        tenantBirthPlace: contract.tenantBirthPlace,
        tenantNationality: contract.tenantNationality,
        tenantProfession: contract.tenantProfession,
        tenantIdDocumentNumber: contract.tenantIdDocumentNumber,
        tenantAddress: contract.tenantAddress,
        propertyRoomCount: body.property?.roomCount ?? contract.propertyRoomCount,
        propertySurfaceSqm: body.property?.surfaceSqm ?? contract.propertySurfaceSqm,
        propertyFloor: body.property?.floor?.trim() ?? contract.propertyFloor,
        ownerPartyCompletedAt: contract.ownerPartyCompletedAt,
        tenantPartyCompletedAt: contract.tenantPartyCompletedAt,
      }

      const missing = validateOwnerPartyProfile(draftSnapshot, contact)
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Informations incompletes : ${missing.join(', ')}`, missingFields: missing },
          { status: 400 }
        )
      }

      const updated = await prisma.contract.update({
        where: { id: contract.id },
        data: {
          ownerBirthDate: birthDate,
          ownerBirthPlace: userPartyData.birthPlace,
          ownerNationality: userPartyData.nationality,
          ownerProfession: userPartyData.profession,
          ownerIdDocumentNumber: userPartyData.idDocumentNumber,
          ownerAddress: userPartyData.currentAddress,
          propertyRoomCount: body.property?.roomCount ?? contract.propertyRoomCount,
          propertySurfaceSqm: body.property?.surfaceSqm ?? contract.propertySurfaceSqm,
          propertyFloor: body.property?.floor?.trim() ?? contract.propertyFloor,
          ownerPartyCompletedAt: new Date(),
        },
      })

      return NextResponse.json({
        message: 'Informations bailleur et bien enregistrees (conformes au modele de bail).',
        ownerPartyCompletedAt: updated.ownerPartyCompletedAt,
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: userPartyData,
    })

    const draftSnapshot: ContractPartySnapshot = {
      ownerBirthDate: contract.ownerBirthDate,
      ownerBirthPlace: contract.ownerBirthPlace,
      ownerNationality: contract.ownerNationality,
      ownerProfession: contract.ownerProfession,
      ownerIdDocumentNumber: contract.ownerIdDocumentNumber,
      ownerAddress: contract.ownerAddress,
      tenantBirthDate: birthDate,
      tenantBirthPlace: userPartyData.birthPlace,
      tenantNationality: userPartyData.nationality,
      tenantProfession: userPartyData.profession,
      tenantIdDocumentNumber: userPartyData.idDocumentNumber,
      tenantAddress: userPartyData.currentAddress,
      propertyRoomCount: contract.propertyRoomCount,
      propertySurfaceSqm: contract.propertySurfaceSqm,
      propertyFloor: contract.propertyFloor,
      ownerPartyCompletedAt: contract.ownerPartyCompletedAt,
      tenantPartyCompletedAt: contract.tenantPartyCompletedAt,
    }

    const missing = validateTenantPartyProfile(draftSnapshot, contact)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Informations incompletes : ${missing.join(', ')}`, missingFields: missing },
        { status: 400 }
      )
    }

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        tenantBirthDate: birthDate,
        tenantBirthPlace: userPartyData.birthPlace,
        tenantNationality: userPartyData.nationality,
        tenantProfession: userPartyData.profession,
        tenantIdDocumentNumber: userPartyData.idDocumentNumber,
        tenantAddress: userPartyData.currentAddress,
        tenantPartyCompletedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Informations locataire enregistrees (conformes au modele de bail).',
      tenantPartyCompletedAt: updated.tenantPartyCompletedAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
