import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error('Production seeding is blocked. Set ALLOW_PROD_SEED=true to run intentionally.')
  }

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'password123'
  const hashedPassword = await bcrypt.hash(defaultPassword, 10)

  const users = [
    { email: 'admin@test.com', name: 'Test Admin', role: 'ADMIN' },
    { email: 'manager@test.com', name: 'Test Manager', role: 'MANAGER' },
    { email: 'tenant@test.com', name: 'Test Tenant', role: 'TENANT' },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        password: hashedPassword,
        isSuspended: false,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword,
        isSuspended: false,
      },
    })
  }

  console.log('Seeded users:')
  console.log(`  - admin@test.com / ${defaultPassword}`)
  console.log(`  - manager@test.com / ${defaultPassword}`)
  console.log(`  - tenant@test.com / ${defaultPassword}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
