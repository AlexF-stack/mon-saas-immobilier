import { NextResponse } from 'next/server'
import { getTokenFromRequest, verifyAuth } from '@/lib/auth'
import { subscribeRealtime } from '@/lib/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await verifyAuth(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))

      write(`event: ready\ndata: {"ok":true}\n\n`)

      const unsubscribe = subscribeRealtime(`notifications:user:${user.id}`, (payload) => {
        write(`event: notification\ndata: ${payload}\n\n`)
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
