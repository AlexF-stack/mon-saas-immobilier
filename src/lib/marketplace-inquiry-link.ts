import { prisma } from '@/lib/prisma'

export async function attachMarketplaceInquiriesToUser(params: {
  userId: string
  email: string
  pendingInquiryId?: string | null
}) {
  const normalizedEmail = params.email.trim().toLowerCase()
  const linkedIds: string[] = []

  if (params.pendingInquiryId) {
    const pending = await prisma.marketplaceInquiry.findUnique({
      where: { id: params.pendingInquiryId },
      select: { id: true, requesterEmail: true, requesterUserId: true },
    })

    if (
      pending &&
      pending.requesterEmail.toLowerCase() === normalizedEmail &&
      (!pending.requesterUserId || pending.requesterUserId === params.userId)
    ) {
      await prisma.marketplaceInquiry.update({
        where: { id: pending.id },
        data: {
          requesterUserId: params.userId,
          guestAccessTokenHash: null,
          guestAccessTokenExpiresAt: null,
        },
      })
      linkedIds.push(pending.id)
    }
  }

  const bulk = await prisma.marketplaceInquiry.updateMany({
    where: {
      requesterEmail: normalizedEmail,
      requesterUserId: null,
    },
    data: {
      requesterUserId: params.userId,
      guestAccessTokenHash: null,
      guestAccessTokenExpiresAt: null,
    },
  })

  return { linkedCount: bulk.count + linkedIds.length, linkedIds }
}
