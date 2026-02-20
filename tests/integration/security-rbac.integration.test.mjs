import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL = process.env.DATABASE_URL ?? 'file:./test.db'
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ?? 'integration_test_secret_abcdefghijklmnopqrstuvwxyz_123456'
const TEST_PASSWORD = 'Passw0rd!'
const TEST_PORT = Number.parseInt(process.env.TEST_PORT ?? '3520', 10)
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DB_URL,
    },
  },
})

let seededUsers = null

async function waitForServerReady(timeoutMs = 30_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/properties`, {
        redirect: 'manual',
      })
      if (response.status < 500) {
        return
      }
    } catch {
      // ignore until server is up
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Test server did not start in time')
}

function createJwtForUser(user, expiresIn = '1d') {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    TEST_JWT_SECRET,
    { expiresIn }
  )
}

async function apiRequest(path, {
  method = 'GET',
  token,
  body,
  headers = {},
  csrf = 'valid',
} = {}) {
  const finalHeaders = {
    ...headers,
  }

  const upperMethod = method.toUpperCase()
  const isSafeMethod = upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS'

  if (token) {
    finalHeaders.cookie = `token=${token}`
  }

  if (!isSafeMethod) {
    if (csrf === 'valid') {
      finalHeaders.origin = 'http://app.test'
      finalHeaders['x-forwarded-proto'] = 'http'
      finalHeaders['x-forwarded-host'] = 'app.test'
    } else if (csrf === 'cross-origin') {
      finalHeaders.origin = 'http://evil.test'
      finalHeaders['x-forwarded-proto'] = 'http'
      finalHeaders['x-forwarded-host'] = 'app.test'
    } else if (csrf === 'cross-site') {
      finalHeaders['sec-fetch-site'] = 'cross-site'
    }
  }

  if (typeof body !== 'undefined') {
    finalHeaders['content-type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: upperMethod,
    headers: finalHeaders,
    body: typeof body !== 'undefined' ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })

  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  return {
    status: response.status,
    json,
    text,
    headers: response.headers,
  }
}

async function resetDatabase() {
  await prisma.notification.deleteMany()
  await prisma.systemLog.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.propertyImage.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany()
}

async function seedUsers() {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10)

  const admin = await prisma.user.create({
    data: {
      email: 'admin.integration@test.com',
      password: hashedPassword,
      name: 'Admin Integration',
      role: 'ADMIN',
      isSuspended: false,
    },
  })

  const ownerA = await prisma.user.create({
    data: {
      email: 'owner.a.integration@test.com',
      password: hashedPassword,
      name: 'Owner A',
      role: 'MANAGER',
      isSuspended: false,
    },
  })

  const ownerB = await prisma.user.create({
    data: {
      email: 'owner.b.integration@test.com',
      password: hashedPassword,
      name: 'Owner B',
      role: 'MANAGER',
      isSuspended: false,
    },
  })

  const tenantA = await prisma.user.create({
    data: {
      email: 'tenant.a.integration@test.com',
      password: hashedPassword,
      name: 'Tenant A',
      role: 'TENANT',
      isSuspended: false,
    },
  })

  const tenantB = await prisma.user.create({
    data: {
      email: 'tenant.b.integration@test.com',
      password: hashedPassword,
      name: 'Tenant B',
      role: 'TENANT',
      isSuspended: false,
    },
  })

  return { admin, ownerA, ownerB, tenantA, tenantB }
}

async function createProperty(managerId, overrides = {}) {
  return prisma.property.create({
    data: {
      title: overrides.title ?? `Property ${Math.random()}`,
      address: overrides.address ?? '1 Test Street',
      price: overrides.price ?? 100000,
      status: overrides.status ?? 'AVAILABLE',
      managerId,
      description: overrides.description ?? null,
    },
  })
}

async function createContract(propertyId, tenantId, overrides = {}) {
  const now = new Date()
  const nextYear = new Date(now)
  nextYear.setFullYear(now.getFullYear() + 1)

  return prisma.contract.create({
    data: {
      propertyId,
      tenantId,
      startDate: overrides.startDate ?? now,
      endDate: overrides.endDate ?? nextYear,
      rentAmount: overrides.rentAmount ?? 100000,
      depositAmount: overrides.depositAmount ?? 50000,
      status: overrides.status ?? 'ACTIVE',
    },
  })
}

before(async () => {
  process.env.DATABASE_URL = TEST_DB_URL
  process.env.JWT_SECRET = TEST_JWT_SECRET

  // Server is started by the test orchestrator (build + next start -p TEST_PORT).
  await waitForServerReady()
})

after(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await resetDatabase()
  seededUsers = await seedUsers()
})

describe('1) RBAC', () => {
  it('POST /api/properties: MANAGER succeeds (201) and property linked to ownerId', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: managerToken,
      body: {
        title: 'Villa A',
        address: 'Rue 10',
        price: 250000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 201)
    assert.equal(result.json.managerId, seededUsers.ownerA.id)
    assert.equal(result.json.status, 'AVAILABLE')
  })

  it('POST /api/properties: TENANT forbidden (403)', async () => {
    const tenantToken = createJwtForUser(seededUsers.tenantA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: tenantToken,
      body: {
        title: 'Villa B',
        address: 'Rue 11',
        price: 180000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST /api/properties: ADMIN forbidden (403)', async () => {
    const adminToken = createJwtForUser(seededUsers.admin)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Villa C',
        address: 'Rue 12',
        price: 190000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST /api/properties: unauthenticated returns 401', async () => {
    const result = await apiRequest('/api/properties', {
      method: 'POST',
      body: {
        title: 'Villa D',
        address: 'Rue 13',
        price: 200000,
        status: 'DISPONIBLE',
      },
      csrf: 'valid',
    })

    assert.equal(result.status, 401)
  })

  it('POST /api/contracts: owner on own property succeeds (201) and property becomes RENTED', async () => {
    const ownerToken = createJwtForUser(seededUsers.ownerA)
    const property = await createProperty(seededUsers.ownerA.id)

    const result = await apiRequest('/api/contracts', {
      method: 'POST',
      token: ownerToken,
      body: {
        propertyId: property.id,
        tenantId: seededUsers.tenantA.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        rentAmount: 120000,
        depositAmount: 50000,
      },
    })

    assert.equal(result.status, 201)

    const updatedProperty = await prisma.property.findUnique({ where: { id: property.id } })
    assert.equal(updatedProperty?.status, 'RENTED')
  })

  it('POST /api/contracts: owner cannot create contract on another owner property (403)', async () => {
    const ownerToken = createJwtForUser(seededUsers.ownerA)
    const foreignProperty = await createProperty(seededUsers.ownerB.id)

    const result = await apiRequest('/api/contracts', {
      method: 'POST',
      token: ownerToken,
      body: {
        propertyId: foreignProperty.id,
        tenantId: seededUsers.tenantA.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        rentAmount: 120000,
        depositAmount: 50000,
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST /api/contracts: tenant cannot create contract (403)', async () => {
    const tenantToken = createJwtForUser(seededUsers.tenantA)
    const property = await createProperty(seededUsers.ownerA.id)

    const result = await apiRequest('/api/contracts', {
      method: 'POST',
      token: tenantToken,
      body: {
        propertyId: property.id,
        tenantId: seededUsers.tenantA.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        rentAmount: 120000,
        depositAmount: 50000,
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST /api/contracts: double active contract denied (409)', async () => {
    const ownerToken = createJwtForUser(seededUsers.ownerA)
    const property = await createProperty(seededUsers.ownerA.id)

    const first = await apiRequest('/api/contracts', {
      method: 'POST',
      token: ownerToken,
      body: {
        propertyId: property.id,
        tenantId: seededUsers.tenantA.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        rentAmount: 120000,
        depositAmount: 50000,
      },
    })

    assert.equal(first.status, 201)

    const second = await apiRequest('/api/contracts', {
      method: 'POST',
      token: ownerToken,
      body: {
        propertyId: property.id,
        tenantId: seededUsers.tenantB.id,
        startDate: '2026-02-01',
        endDate: '2027-02-01',
        rentAmount: 130000,
        depositAmount: 50000,
      },
    })

    assert.equal(second.status, 409)
  })
})

describe('2) CSRF', () => {
  it('POST without Origin returns 403', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: managerToken,
      csrf: 'none',
      body: {
        title: 'CSRF 1',
        address: 'Rue 20',
        price: 150000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST with different Origin returns 403', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: managerToken,
      csrf: 'cross-origin',
      body: {
        title: 'CSRF 2',
        address: 'Rue 21',
        price: 150000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 403)
  })

  it('POST with Sec-Fetch-Site cross-site returns 403', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: managerToken,
      csrf: 'cross-site',
      body: {
        title: 'CSRF 3',
        address: 'Rue 22',
        price: 150000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 403)
  })

  it('valid request returns 201', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'POST',
      token: managerToken,
      csrf: 'valid',
      body: {
        title: 'CSRF OK',
        address: 'Rue 23',
        price: 150000,
        status: 'DISPONIBLE',
      },
    })

    assert.equal(result.status, 201)
  })
})

describe('3) JWT', () => {
  it('invalid token returns 401', async () => {
    const validToken = createJwtForUser(seededUsers.ownerA)
    const invalidToken = `${validToken.slice(0, -1)}x`

    const result = await apiRequest('/api/properties', {
      method: 'GET',
      token: invalidToken,
    })

    assert.equal(result.status, 401)
  })

  it('expired token returns 401', async () => {
    const expiredToken = createJwtForUser(seededUsers.ownerA, -60)

    const result = await apiRequest('/api/properties', {
      method: 'GET',
      token: expiredToken,
    })

    assert.equal(result.status, 401)
  })

  it('valid token returns 200', async () => {
    const managerToken = createJwtForUser(seededUsers.ownerA)

    const result = await apiRequest('/api/properties', {
      method: 'GET',
      token: managerToken,
    })

    assert.equal(result.status, 200)
  })
})

describe('4) Transaction contract/property', () => {
  it('forced failure rolls back contract and property status', async () => {
    const ownerToken = createJwtForUser(seededUsers.ownerA)
    const property = await createProperty(seededUsers.ownerA.id, { status: 'AVAILABLE' })

    const result = await apiRequest('/api/contracts', {
      method: 'POST',
      token: ownerToken,
      headers: {
        'x-test-force-contract-rollback': '1',
      },
      body: {
        propertyId: property.id,
        tenantId: seededUsers.tenantA.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        rentAmount: 120000,
        depositAmount: 50000,
      },
    })

    assert.equal(result.status, 500)

    const [contractCount, refreshedProperty] = await Promise.all([
      prisma.contract.count({ where: { propertyId: property.id } }),
      prisma.property.findUnique({ where: { id: property.id } }),
    ])

    assert.equal(contractCount, 0)
    assert.equal(refreshedProperty?.status, 'AVAILABLE')
  })
})

describe('5) Multi-tenant isolation', () => {
  it('Owner A cannot see Owner B data', async () => {
    const ownerAToken = createJwtForUser(seededUsers.ownerA)

    const propertyA = await createProperty(seededUsers.ownerA.id, { title: 'Owner A Property' })
    const propertyB = await createProperty(seededUsers.ownerB.id, { title: 'Owner B Property' })

    const contractA = await createContract(propertyA.id, seededUsers.tenantA.id)
    const contractB = await createContract(propertyB.id, seededUsers.tenantB.id)

    await prisma.property.update({ where: { id: propertyA.id }, data: { status: 'RENTED' } })
    await prisma.property.update({ where: { id: propertyB.id }, data: { status: 'RENTED' } })

    const [propertiesRes, contractsRes, tenantsRes] = await Promise.all([
      apiRequest('/api/properties', { method: 'GET', token: ownerAToken }),
      apiRequest('/api/contracts', { method: 'GET', token: ownerAToken }),
      apiRequest('/api/tenants', { method: 'GET', token: ownerAToken }),
    ])

    assert.equal(propertiesRes.status, 200)
    assert.equal(contractsRes.status, 200)
    assert.equal(tenantsRes.status, 200)

    const propertyIds = propertiesRes.json.map((p) => p.id)
    assert.deepEqual(propertyIds, [propertyA.id])

    const contractIds = contractsRes.json.map((c) => c.id)
    assert.deepEqual(contractIds, [contractA.id])
    assert.ok(!contractIds.includes(contractB.id))

    const tenantIds = tenantsRes.json.map((t) => t.id)
    assert.ok(tenantIds.includes(seededUsers.tenantA.id))
    assert.ok(!tenantIds.includes(seededUsers.tenantB.id))
  })
})

describe('6) Audit admin', () => {
  it('role change creates audit log', async () => {
    const adminToken = createJwtForUser(seededUsers.admin)

    const result = await apiRequest(`/api/admin/users/${seededUsers.tenantA.id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'MANAGER' },
    })

    assert.equal(result.status, 200)

    const log = await prisma.systemLog.findFirst({
      where: {
        action: 'USER_ROLE_CHANGED',
        targetId: seededUsers.tenantA.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    assert.ok(log)
  })

  it('suspended user cannot login', async () => {
    const adminToken = createJwtForUser(seededUsers.admin)

    const suspendRes = await apiRequest(`/api/admin/users/${seededUsers.tenantA.id}/suspend`, {
      method: 'PATCH',
      token: adminToken,
      body: { suspended: true },
    })

    assert.equal(suspendRes.status, 200)

    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      csrf: 'valid',
      body: {
        email: seededUsers.tenantA.email,
        password: TEST_PASSWORD,
      },
    })

    assert.equal(loginRes.status, 403)
  })

  it('admin cannot self-downgrade', async () => {
    const adminToken = createJwtForUser(seededUsers.admin)

    const result = await apiRequest(`/api/admin/users/${seededUsers.admin.id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'MANAGER' },
    })

    assert.equal(result.status, 400)
  })
})
