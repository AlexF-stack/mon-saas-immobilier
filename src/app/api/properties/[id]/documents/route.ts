import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getTokenFromRequest } from '@/lib/auth'
import { canManageProperty } from '@/lib/rbac'
import { enforceCsrf } from '@/lib/csrf'
import { normalizePropertyDocumentType, persistUploadedFile } from '@/lib/property-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, managerId: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (user.role === 'TENANT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canManageProperty(user, property.managerId) && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const documents = await prisma.propertyDocument.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        documentType: true,
        url: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    })

    return NextResponse.json(documents)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

const uploadSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  documentType: z.string().optional(),
})

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
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, managerId: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (!canManageProperty(user, property.managerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 })
    }

    const meta = uploadSchema.parse({
      title: typeof formData.get('title') === 'string' ? formData.get('title') : undefined,
      documentType:
        typeof formData.get('documentType') === 'string' ? formData.get('documentType') : undefined,
    })

    const stored = await persistUploadedFile(file, { kind: 'document' })
    if ('error' in stored) {
      return NextResponse.json({ error: stored.error }, { status: stored.status })
    }

    const document = await prisma.propertyDocument.create({
      data: {
        propertyId: id,
        title: meta.title ?? (file.name.replace(/\.[^.]+$/, '') || 'Document foncier'),
        documentType: normalizePropertyDocumentType(meta.documentType),
        url: stored.url,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await verifyAuth(token)
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: propertyId } = await params
    const url = new URL(request.url)
    const documentId = url.searchParams.get('documentId')?.trim()
    if (!documentId) {
      return NextResponse.json({ error: 'documentId requis.' }, { status: 400 })
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { managerId: true },
    })
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    if (!canManageProperty(user, property.managerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.propertyDocument.findFirst({
      where: { id: documentId, propertyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const remaining = await prisma.propertyDocument.count({
      where: { propertyId, id: { not: documentId } },
    })
    if (remaining < 1) {
      return NextResponse.json(
        { error: 'Au moins un document foncier doit rester associe au bien.' },
        { status: 409 }
      )
    }

    await prisma.propertyDocument.delete({ where: { id: documentId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
