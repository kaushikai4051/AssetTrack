'use strict'
/**
 * Government Schemes route tests.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals')
const request = require('supertest')

let mockExecute, mockGetConnection, mockConn

jest.mock('../../src/plugins/db', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    mockConn = {
      execute: jest.fn(),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    }
    mockExecute = jest.fn()
    mockGetConnection = jest.fn().mockResolvedValue(mockConn)
    fastify.decorate('db', { execute: mockExecute, getConnection: mockGetConnection })
  })
})

jest.mock('../../src/plugins/redis', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    fastify.decorate('redis', { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() })
    fastify.decorate('redisAvailable', false)
  })
})

process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = require('../../src/app')

beforeAll(async () => { await app.ready() })
afterAll(async () => { await app.close() })
beforeEach(() => {
  jest.clearAllMocks()
  if (mockExecute) mockExecute.mockReset()
  if (mockConn) {
    mockConn.execute.mockReset()
    mockConn.beginTransaction.mockResolvedValue(undefined)
    mockConn.commit.mockResolvedValue(undefined)
    mockConn.rollback.mockResolvedValue(undefined)
    mockConn.release.mockReturnValue(undefined)
  }
  if (mockGetConnection) mockGetConnection.mockResolvedValue(mockConn)
})

async function getToken(userId = 1) {
  return app.jwt.sign({ id: userId, email: 'user@example.com' }, { expiresIn: '15m' })
}

// ── Create helpers ────────────────────────────────────────────────────────────

function setupCreateMocks() {
  mockConn.execute
    .mockResolvedValueOnce([{ insertId: 200, affectedRows: 1 }])  // INSERT assets
    .mockResolvedValueOnce([{ insertId: 50, affectedRows: 1 }])   // INSERT govt_scheme_holdings
}

// ── PPF ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (PPF)', () => {
  test('valid PPF body returns 201 with asset_id', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'ppf',
        account_number: 'PPF-001234567',
        institution: 'State Bank of India',
        start_date: '2020-04-01',
        interest_rate: 7.1,
        invested_amount: 150000,
        current_value: 180000,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })
})

// ── NPS ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (NPS)', () => {
  test('valid NPS body with tier I returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'nps',
        pran: 'PRAN1234567890',
        nps_account_type: 'tier1',
        fund_manager: 'HDFC Pension',
        institution: 'NPS Trust',
        invested_amount: 200000,
        current_value: 225000,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })

  test('valid NPS body with tier II returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'nps',
        pran: 'PRAN9876543210',
        nps_account_type: 'tier2',
        fund_manager: 'SBI Pension Funds',
        invested_amount: 50000,
        current_value: 55000,
      })

    expect(res.status).toBe(201)
  })
})

// ── EPF ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (EPF)', () => {
  test('valid EPF body with UAN returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'epf',
        uan: '100234567890',
        institution: 'EPFO',
        employee_share: 120000,
        employer_share: 120000,
        eps_balance: 50000,
        invested_amount: 240000,
        current_value: 270000,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })
})

// ── SSY ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (SSY)', () => {
  test('girl child SSY account returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'ssy',
        account_number: 'SSY-9876543',
        institution: 'Post Office',
        beneficiary_name: 'Ananya Sharma',
        beneficiary_dob: '2015-03-12',
        start_date: '2022-04-01',
        interest_rate: 8.2,
        invested_amount: 75000,
        current_value: 85000,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })
})

// ── NSC ───────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (NSC)', () => {
  test('NSC certificate returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'nsc',
        account_number: 'NSC-00123456',
        institution: 'India Post',
        start_date: '2022-01-01',
        interest_rate: 7.7,
        invested_amount: 100000,
      })

    expect(res.status).toBe(201)
  })
})

// ── SCSS ──────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes (SCSS)', () => {
  test('SCSS account returns 201', async () => {
    const token = await getToken()
    setupCreateMocks()

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_type: 'scss',
        account_number: 'SCSS-9001',
        institution: 'State Bank of India',
        start_date: '2023-04-01',
        interest_rate: 8.2,
        invested_amount: 500000,
        current_value: 500000,
      })

    expect(res.status).toBe(201)
  })
})

// ── List ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/assets/govt-schemes', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/assets/govt-schemes')
    expect(res.status).toBe(401)
  })

  test('returns all scheme types for user with pnl fields', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[
      {
        asset_id: 200, scheme_type: 'ppf',
        account_number: 'PPF-001234567', institution: 'SBI',
        start_date: null, maturity_date: null,
        current_value: '180000', invested_amount: '150000',
        interest_rate: '7.10', pran: null, uan: null, notes: null,
        nps_account_type: null, fund_manager: null,
        employee_share: null, employer_share: null, eps_balance: null,
        beneficiary_name: null, beneficiary_dob: null,
        maturity_amount: null, nominee: null, maturity_period_months: null,
      },
    ]])

    const res = await request(app.server)
      .get('/api/v1/assets/govt-schemes')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toHaveProperty('pnl')
    expect(res.body[0]).toHaveProperty('pnl_pct')
    expect(res.body[0].scheme_type).toBe('ppf')
  })
})

// ── PPF Transactions ──────────────────────────────────────────────────────────

describe('POST /api/v1/assets/govt-schemes/:id/transactions', () => {
  test('annual PPF contribution updates balance', async () => {
    const token = await getToken()
    // List to find holding
    mockExecute.mockResolvedValueOnce([[{ id: 50, asset_id: 200 }]])

    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])  // INSERT tx
      .mockResolvedValueOnce([{ affectedRows: 1 }])                // UPDATE assets

    const res = await request(app.server)
      .post('/api/v1/assets/govt-schemes/200/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tx_date: '2025-03-31',
        tx_type: 'deposit',
        amount: 150000,
        description: 'Annual PPF contribution FY2024-25',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })
})

// ── Delete ────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/assets/govt-schemes/:id', () => {
  test('found scheme returns 200 (soft delete)', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ asset_id: 200 }]])  // SELECT for ownership
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE is_active=0

    const res = await request(app.server)
      .delete('/api/v1/assets/govt-schemes/200')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .delete('/api/v1/assets/govt-schemes/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
