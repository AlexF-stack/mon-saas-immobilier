import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { createSystemLog } from '@/lib/audit'
import { getLogContextFromRequest } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const exportFormatSchema = z.enum(['csv', 'xlsx'])
const paymentStatusSchema = z.enum(['COMPLETED', 'PENDING', 'FAILED'])
const paymentMethodSchema = z.enum(['MOMO_MTN', 'MOOV', 'CASH'])

function normalizeDate(raw: string | null): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toEndOfDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1)
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function escapeXml(value: unknown): string {
  const text = String(value ?? '')
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type ExportRow = {
  date: string
  transactionId: string
  status: string
  method: string
  amount: string
  propertyTitle: string
  tenantName: string
  contractId: string
}

function toCsv(rows: ExportRow[]): string {
  const headers = ['Date', 'Transaction', 'Statut', 'Methode', 'Montant FCFA', 'Bien', 'Locataire', 'Contrat']
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.transactionId,
        row.status,
        row.method,
        row.amount,
        row.propertyTitle,
        row.tenantName,
        row.contractId,
      ]
        .map(escapeCsv)
        .join(',')
    )
  }
  return lines.join('\n')
}

function toExcelXml(rows: ExportRow[]): string {
  const headers = ['Date', 'Transaction', 'Statut', 'Methode', 'Montant FCFA', 'Bien', 'Locataire', 'Contrat']

  const headerXml = headers
    .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
    .join('')

  const bodyXml = rows
    .map((row) => {
      return `
        <Row>
          <Cell><Data ss:Type="String">${escapeXml(row.date)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.transactionId)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.status)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.method)}</Data></Cell>
          <Cell><Data ss:Type="Number">${escapeXml(row.amount)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.propertyTitle)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.tenantName)}</Data></Cell>
          <Cell><Data ss:Type="String">${escapeXml(row.contractId)}</Data></Cell>
        </Row>
      `
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Paiements">
    <Table>
      <Row>${headerXml}</Row>
      ${bodyXml}
    </Table>
  </Worksheet>
</Workbook>`
}

export async function GET(request: Request) {
  try {
    const { correlationId, route } = getLogContextFromRequest(request)
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await verifyAuth(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const query = (url.searchParams.get('q') ?? '').trim()
    const statusRaw = url.searchParams.get('status')
    const methodRaw = url.searchParams.get('method')
    const formatRaw = (url.searchParams.get('format') ?? 'csv').trim().toLowerCase()

    const formatParsed = exportFormatSchema.safeParse(formatRaw)
    if (!formatParsed.success) {
      return NextResponse.json({ error: 'Invalid format. Use csv or xlsx.' }, { status: 400 })
    }
    const statusParsed = paymentStatusSchema.safeParse(statusRaw ?? '')
    const methodParsed = paymentMethodSchema.safeParse(methodRaw ?? '')

    const fromDate = normalizeDate(url.searchParams.get('from'))
    const toDateBase = normalizeDate(url.searchParams.get('to'))
    const toDate = toDateBase ? toEndOfDay(toDateBase) : null

    if ((url.searchParams.get('from') && !fromDate) || (url.searchParams.get('to') && !toDate)) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 })
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json({ error: 'from date must be before to date.' }, { status: 400 })
    }

    const scopeWhere: Prisma.PaymentWhereInput =
      user.role === 'MANAGER'
        ? { contract: { property: { managerId: user.id } } }
        : user.role === 'TENANT'
          ? { contract: { tenantId: user.id } }
          : {}

    const andFilters: Prisma.PaymentWhereInput[] = []
    if (statusParsed.success) andFilters.push({ status: statusParsed.data })
    if (methodParsed.success) andFilters.push({ method: methodParsed.data })
    if (query) {
      andFilters.push({
        OR: [
          { transactionId: { contains: query, mode: 'insensitive' } },
          { method: { contains: query, mode: 'insensitive' } },
          { contract: { property: { title: { contains: query, mode: 'insensitive' } } } },
          { contract: { tenant: { name: { contains: query, mode: 'insensitive' } } } },
          { contract: { tenant: { email: { contains: query, mode: 'insensitive' } } } },
        ],
      })
    }
    if (fromDate || toDate) {
      andFilters.push({
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      })
    }

    const where: Prisma.PaymentWhereInput =
      andFilters.length > 0 ? { ...scopeWhere, AND: andFilters } : scopeWhere

    const payments = await prisma.payment.findMany({
      where,
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const rows: ExportRow[] = payments.map((payment) => ({
      date: payment.createdAt.toLocaleDateString('fr-FR'),
      transactionId: payment.transactionId ?? payment.id,
      status: payment.status,
      method: payment.method,
      amount: String(Math.round(payment.amount)),
      propertyTitle: payment.contract.property.title,
      tenantName: payment.contract.tenant.name || payment.contract.tenant.email,
      contractId: payment.contractId,
    }))

    const dayToken = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const format = formatParsed.data

    await createSystemLog({
      actor: user,
      action: 'EXPORT_PAYMENTS',
      targetType: 'PAYMENT',
      targetId: undefined,
      correlationId,
      route,
      details: `format=${format};rowCount=${rows.length};from=${url.searchParams.get('from') ?? 'none'};to=${url.searchParams.get('to') ?? 'none'};status=${statusParsed.success ? statusParsed.data : 'none'};method=${methodParsed.success ? methodParsed.data : 'none'};q=${query || 'none'}`,
    })

    if (format === 'xlsx') {
      const xml = toExcelXml(rows)
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="payments-${dayToken}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const csv = toCsv(rows)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payments-${dayToken}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Payment export error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
