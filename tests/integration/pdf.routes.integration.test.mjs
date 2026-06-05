import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const TEST_PORT = Number.parseInt(process.env.TEST_PORT ?? '3520', 10)
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`
const JWT_SECRET = process.env.JWT_SECRET ?? 'integration_test_secret_abcdefghijklmnopqrstuvwxyz_123456'

const prisma = new PrismaClient()

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '1h',
  })
}

async function resetDatabase() {
  await prisma.systemLog.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.propertyImage.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany()
}

async function apiRequest(path, { token } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: token ? { cookie: `token=${token}` } : undefined,
    redirect: 'manual',
  })

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    buffer: Buffer.from(await response.arrayBuffer()),
  }
}

beforeEach(async () => {
  await resetDatabase()
})

afterEach(async () => {
  await resetDatabase()
})

describe('PDF routes', () => {
  it('GET /api/contracts/:id/download returns a valid PDF', async () => {
    const manager = await prisma.user.create({
      data: { email: 'manager.pdf@test.com', password: 'hashed', name: 'Manager PDF', role: 'MANAGER' },
    })
    const tenant = await prisma.user.create({
      data: { email: 'tenant.pdf@test.com', password: 'hashed', name: 'Tenant PDF', role: 'TENANT' },
    })

    const property = await prisma.property.create({
      data: {
        title: 'Villa Centre',
        address: '12 rue des Pins',
        city: 'Cotonou',
        price: 180000,
        offerType: 'RENT',
        propertyType: 'APARTMENT',
        isPublished: true,
        managerId: manager.id,
      },
    })

    const contract = await prisma.contract.create({
      data: {
        contractNumber: 'CTR-TEST-001',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        rentAmount: 180000,
        depositAmount: 180000,
        contractType: 'RENTAL',
        propertyId: property.id,
        tenantId: tenant.id,
      },
    })

    const response = await apiRequest(`/api/contracts/${contract.id}/download`, {
      token: createToken(manager),
    })

    assert.equal(response.status, 200)
    assert.match(response.contentType, /application\/pdf/)
    assert.equal(Buffer.from(response.buffer.slice(0, 5)).toString('hex'), '255044462d')
  })

  it('GET /api/payments/:id/receipt returns a valid PDF', async () => {
    const manager = await prisma.user.create({
      data: { email: 'manager.receipt@test.com', password: 'hashed', name: 'Manager Receipt', role: 'MANAGER' },
    })
    const tenant = await prisma.user.create({
      data: { email: 'tenant.receipt@test.com', password: 'hashed', name: 'Tenant Receipt', role: 'TENANT' },
    })

    const property = await prisma.property.create({
      data: {
        title: 'Villa Centre',
        address: '12 rue des Pins',
        city: 'Cotonou',
        price: 180000,
        offerType: 'RENT',
        propertyType: 'APARTMENT',
        isPublished: true,
        managerId: manager.id,
      },
    })

    const contract = await prisma.contract.create({
      data: {
        contractNumber: 'CTR-TEST-002',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        rentAmount: 180000,
        depositAmount: 180000,
        contractType: 'RENTAL',
        propertyId: property.id,
        tenantId: tenant.id,
      },
    })

    const payment = await prisma.payment.create({
      data: {
        amount: 180000,
        status: 'COMPLETED',
        type: 'RENT',
        method: 'MTN Mobile Money',
        transactionId: 'TXN-001',
        receiptNumber: 'RCP-TEST-001',
        contractId: contract.id,
      },
    })

    const response = await apiRequest(`/api/payments/${payment.id}/receipt`, {
      token: createToken(manager),
    })

    assert.equal(response.status, 200)
    assert.match(response.contentType, /application\/pdf/)
    assert.equal(Buffer.from(response.buffer.slice(0, 5)).toString('hex'), '255044462d')
  })
})
