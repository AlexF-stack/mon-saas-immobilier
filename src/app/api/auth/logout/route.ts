import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { enforceCsrf } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const csrfError = enforceCsrf(request)
    if (csrfError) return csrfError

    const cookieStore = await cookies()
    cookieStore.delete('token')
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'))
}
