import { redirect } from 'next/navigation'

export default async function MarketplaceDetailRedirectPage(props: {
    params: Promise<{ propertyId: string }>
}) {
    const { propertyId } = await props.params
    redirect(`/en/marketplace/${propertyId}`)
}
