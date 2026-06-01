import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function persistUploadedFile(
  file: File,
  options: { kind: 'image' | 'document'; uploadsSubdir?: string }
): Promise<{ url: string; mimeType: string; fileSize: number } | { error: string; status: number }> {
  const maxSize = options.kind === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_DOCUMENT_SIZE_BYTES
  const allowed = options.kind === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES

  if (file.size > maxSize) {
    return {
      error:
        options.kind === 'image'
          ? 'Image trop volumineuse. Taille max 2 Mo.'
          : 'Document trop volumineux. Taille max 5 Mo.',
      status: 413,
    }
  }

  if (!allowed.has(file.type)) {
    return {
      error:
        options.kind === 'image'
          ? 'Format image non supporte. Utilisez JPG, PNG ou WEBP.'
          : 'Format document non supporte. Utilisez PDF, JPG, PNG ou WEBP.',
      status: 400,
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const dataUri = `data:${file.type};base64,${base64}`

  if (process.env.VERCEL === '1') {
    return { url: dataUri, mimeType: file.type, fileSize: file.size }
  }

  try {
    const subdir = options.uploadsSubdir ?? (options.kind === 'image' ? 'uploads' : 'uploads/documents')
    const uploadsDir = join(process.cwd(), 'public', subdir)
    try {
      mkdirSync(uploadsDir, { recursive: true })
    } catch {}

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
    const filepath = join(uploadsDir, filename)
    writeFileSync(filepath, buffer)
    return { url: `/${subdir}/${filename}`, mimeType: file.type, fileSize: file.size }
  } catch {
    return { url: dataUri, mimeType: file.type, fileSize: file.size }
  }
}

export const PROPERTY_DOCUMENT_TYPES = [
  'TITLE_DEED',
  'CADASTRAL_PLAN',
  'TAX_RECEIPT',
  'OTHER',
] as const

export type PropertyDocumentType = (typeof PROPERTY_DOCUMENT_TYPES)[number]

export function normalizePropertyDocumentType(input?: string): PropertyDocumentType {
  const value = (input ?? 'OTHER').trim().toUpperCase()
  if (PROPERTY_DOCUMENT_TYPES.includes(value as PropertyDocumentType)) {
    return value as PropertyDocumentType
  }
  return 'OTHER'
}
