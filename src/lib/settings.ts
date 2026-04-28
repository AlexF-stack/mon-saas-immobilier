import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/auth'

export type SettingsProfileSnapshot = {
    id: string
    email: string
    role: UserRole
    name: string | null
    phone: string | null
    avatarUrl: string | null
    preferredLanguage: string
    notifyEmail: boolean
    notifySms: boolean
    notifyWhatsapp: boolean
    notifyPush: boolean
    twoFactorEnabled: boolean
    dashboardCompact: boolean
    companyName: string | null
    companyLogoUrl: string | null
    rentalTermsTemplate: string | null
    reminderChannelEmail: boolean
    reminderChannelSms: boolean
    reminderChannelWhatsapp: boolean
    paymentCollectionMode: string
    paymentMomoNumber: string | null
    paymentMomoProvider: string | null
    paymentCardLink: string | null
    paymentInstructions: string | null
    lastLoginAt: string | null
    createdAt: string
    updatedAt: string
}

export type LoginHistorySnapshot = {
    id: string
    ipAddress: string | null
    userAgent: string | null
    success: boolean
    createdAt: string
}

export type WishlistSnapshot = {
    propertyId: string
    createdAt: string
    title: string
    city: string | null
    address: string
    price: number
    status: string
}

export type SystemConfigSnapshot = {
    key: string
    value: string
    description: string | null
    updatedAt: string
}

export type SettingsPageSnapshot = {
    profile: SettingsProfileSnapshot
    loginHistory: LoginHistorySnapshot[]
    wishlist: WishlistSnapshot[]
    systemConfig: SystemConfigSnapshot[]
}

export async function getSettingsPageSnapshot(
    userId: string,
    role: UserRole
): Promise<SettingsPageSnapshot | null> {
    const profile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            role: true,
            name: true,
            phone: true,
            avatarUrl: true,
            preferredLanguage: true,
            notifyEmail: true,
            notifySms: true,
            notifyWhatsapp: true,
            notifyPush: true,
            twoFactorEnabled: true,
            dashboardCompact: true,
            companyName: true,
            companyLogoUrl: true,
            rentalTermsTemplate: true,
            reminderChannelEmail: true,
            reminderChannelSms: true,
            reminderChannelWhatsapp: true,
            paymentCollectionMode: true,
            paymentMomoNumber: true,
            paymentMomoProvider: true,
            paymentCardLink: true,
            paymentInstructions: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!profile) return null

    const [loginHistory, wishlist, systemConfig] = await Promise.all([
        prisma.loginHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                ipAddress: true,
                userAgent: true,
                success: true,
                createdAt: true,
            },
        }),
        role === 'TENANT'
            ? prisma.wishlistItem.findMany({
                  where: { userId },
                  orderBy: { createdAt: 'desc' },
                  include: {
                      property: {
                          select: {
                              id: true,
                              title: true,
                              city: true,
                              address: true,
                              price: true,
                              status: true,
                              isPublished: true,
                          },
                      },
                  },
              })
            : Promise.resolve([]),
        role === 'ADMIN'
            ? prisma.systemConfig.findMany({
                  orderBy: { key: 'asc' },
                  select: {
                      key: true,
                      value: true,
                      description: true,
                      updatedAt: true,
                  },
              })
            : Promise.resolve([]),
    ])

    return {
        profile: {
            id: profile.id,
            email: profile.email,
            role,
            name: profile.name,
            phone: profile.phone,
            avatarUrl: profile.avatarUrl,
            preferredLanguage: profile.preferredLanguage,
            notifyEmail: profile.notifyEmail,
            notifySms: profile.notifySms,
            notifyWhatsapp: profile.notifyWhatsapp,
            notifyPush: profile.notifyPush,
            twoFactorEnabled: profile.twoFactorEnabled,
            dashboardCompact: profile.dashboardCompact,
            companyName: profile.companyName,
            companyLogoUrl: profile.companyLogoUrl,
            rentalTermsTemplate: profile.rentalTermsTemplate,
            reminderChannelEmail: profile.reminderChannelEmail,
            reminderChannelSms: profile.reminderChannelSms,
            reminderChannelWhatsapp: profile.reminderChannelWhatsapp,
            paymentCollectionMode: profile.paymentCollectionMode,
            paymentMomoNumber: profile.paymentMomoNumber,
            paymentMomoProvider: profile.paymentMomoProvider,
            paymentCardLink: profile.paymentCardLink,
            paymentInstructions: profile.paymentInstructions,
            lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        },
        loginHistory: loginHistory.map((entry) => ({
            id: entry.id,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            success: entry.success,
            createdAt: entry.createdAt.toISOString(),
        })),
        wishlist:
            role === 'TENANT'
                ? wishlist
                      .filter((entry) => entry.property.isPublished)
                      .map((entry) => ({
                          propertyId: entry.propertyId,
                          createdAt: entry.createdAt.toISOString(),
                          title: entry.property.title,
                          city: entry.property.city,
                          address: entry.property.address,
                          price: entry.property.price,
                          status: entry.property.status,
                      }))
                : [],
        systemConfig:
            role === 'ADMIN'
                ? systemConfig.map((entry) => ({
                      key: entry.key,
                      value: entry.value,
                      description: entry.description,
                      updatedAt: entry.updatedAt.toISOString(),
                  }))
                : [],
    }
}
