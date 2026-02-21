import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function ensureBootstrapAdmin(
    normalizedEmail: string
) {
    if (process.env.NODE_ENV === 'production') {
        return
    }

    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim()

    const devDefaultEmail = 'admin@test.com'
    const devDefaultPassword = 'password123'

    const hasConfiguredCredentials = Boolean(configuredEmail && configuredPassword)
    const activeEmail = hasConfiguredCredentials
        ? configuredEmail
        : devDefaultEmail
    const activePassword = hasConfiguredCredentials
        ? configuredPassword
        : devDefaultPassword

    if (!activeEmail || !activePassword) {
        return
    }

    if (normalizedEmail !== activeEmail) {
        return
    }

    const hashedPassword = await hashPassword(activePassword)
    const existing = await prisma.user.findFirst({
        where: {
            email: {
                equals: activeEmail,
                mode: 'insensitive',
            },
        },
        select: { id: true, email: true },
    })

    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: {
                email: activeEmail,
                role: 'ADMIN',
                isSuspended: false,
                password: hashedPassword,
            },
        })
        return
    }

    await prisma.user.create({
        data: {
            email: activeEmail,
            name: 'Bootstrap Admin',
            role: 'ADMIN',
            password: hashedPassword,
            isSuspended: false,
        },
    })
}
