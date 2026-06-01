import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { subscribeRealtime } from '@/lib/realtime'
import {
  hashGuestInquiryAccessToken,
  isGuestInquiryAccessExpired,
} from '@/lib/marketplace-inquiry-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function canAccessInquiry(inquiryId: string, request: Request) {
  const url = new URL(request.url)
  const guestToken = url.searchParams.get('guestToken')?.trim() ?? ''
  const token = getTokenFromRequest(request)
  const user = token ? await verifyAuth(token) : null

  const inquiry = await prisma.marketplaceInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      requesterUserId: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      property: { select: { managerId: true } },
    },
  })

  if (!inquiry) return { status: 404 as const }

  if (user) {
    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'MANAGER' && inquiry.property.managerId === user.id) ||
      inquiry.requesterUserId === user.id
    return allowed ? { status: 200 as const } : { status: 403 as const }
  }

  if (!guestToken || !inquiry.guestAccessTokenHash) return { status: 401 as const }
  if (isGuestInquiryAccessExpired(inquiry.guestAccessTokenExpiresAt)) return { status: 401 as const }

  const providedHash = hashGuestInquiryAccessToken(guestToken)
  return providedHash === inquiry.guestAccessTokenHash ? { status: 200 as const } : { status: 401 as const }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const access = await canAccessInquiry(id, request)
  if (access.status === 404) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
  }
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 403 ? 'Forbidden' : 'Unauthorized' },
      { status: access.status }
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))

      write(`event: ready\ndata: {"ok":true}\n\n`)

      const unsubscribe = subscribeRealtime(`inquiry:${id}:messages`, (payload) => {
        write(`event: message\ndata: ${payload}\n\n`)
      })

      const heartbeat = setInterval(() => {
        write(`event: ping\ndata: {"ts":${Date.now()}}\n\n`)
      }, 15000)

      const abort = () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }

      request.signal.addEventListener('abort', abort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
