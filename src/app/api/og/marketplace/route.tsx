import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ImmoSaaS Marketplace'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')?.slice(0, 90) ?? 'Marketplace ImmoSaaS'
    const subtitle =
        searchParams.get('subtitle')?.slice(0, 130) ??
        'Biens disponibles a la location - visites et demandes en ligne.'

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0b1220 100%)',
                    color: '#f8fafc',
                    padding: '56px',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '14px',
                        fontSize: 30,
                        fontWeight: 700,
                    }}
                >
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                        }}
                    >
                        I
                    </div>
                    ImmoSaaS Marketplace
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '960px' }}>
                    <div style={{ fontSize: 62, lineHeight: 1.1, fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: 30, lineHeight: 1.25, color: '#cbd5e1' }}>{subtitle}</div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 22,
                        color: '#94a3b8',
                    }}
                >
                    <span>Locations premium</span>
                    <span>immo-saas</span>
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
