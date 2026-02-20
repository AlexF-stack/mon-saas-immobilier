import { redirect } from 'next/navigation'

export default async function MarketplaceCityRedirectPage(props: {
    params: Promise<{ citySlug: string }>
}) {
    const { citySlug } = await props.params
    redirect(`/en/marketplace/city/${citySlug}`)
}
