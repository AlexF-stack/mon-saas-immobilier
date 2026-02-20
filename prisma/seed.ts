import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      name: 'Test Admin',
      role: 'ADMIN',
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {},
    create: {
      email: 'manager@test.com',
      password: hashedPassword,
      name: 'Test Manager',
      role: 'MANAGER',
    },
  })

  await prisma.user.upsert({
    where: { email: 'tenant@test.com' },
    update: {},
    create: {
      email: 'tenant@test.com',
      password: hashedPassword,
      name: 'Test Tenant',
      role: 'TENANT',
    },
  })

  console.log('Test users created:')
  console.log('  - admin@test.com / password123')
  console.log('  - manager@test.com / password123')
  console.log('  - tenant@test.com / password123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
