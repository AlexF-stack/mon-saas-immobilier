export function getClientIpFromHeaders(headers: Headers): string | null {
    const forwardedFor = headers.get('x-forwarded-for')
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim()
        if (firstIp) return firstIp
    }

    const realIp = headers.get('x-real-ip')?.trim()
    if (realIp) return realIp

    return null
}
