import { prisma } from '@/lib/prisma'
import { publishRealtime } from '@/lib/realtime'

export async function createAppNotification(params: {
  userId: string
  type: string
  title: string
  message: string
  paymentId?: string
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      paymentId: params.paymentId ?? null,
    },
  })

  publishRealtime(`notifications:user:${params.userId}`, {
    type: params.type,
    createdAt: new Date().toISOString(),
  })
}

export async function createAppNotifications(
  userIds: Iterable<string>,
  params: Omit<Parameters<typeof createAppNotification>[0], 'userId'>
) {
  const unique = [...new Set(userIds)]
  for (const userId of unique) {
    await createAppNotification({ ...params, userId })
  }
}
