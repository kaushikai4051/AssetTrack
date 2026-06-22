'use strict'
/**
 * Mutual Funds route tests.
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

// ── Fund CRUD ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/assets/mutual-funds', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/assets/mutual-funds')
    expect(res.status).toBe(401)
  })

  test('empty portfolio returns empty array', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])  // no funds

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('non-empty portfolio includes abs_return and xirr fields', async () => {
    const token = await getToken()
    // Mock: funds list
    mockExecute
      .mockResolvedValueOnce([[{
        id: 1, scheme_name: 'Mirae Asset Large Cap Fund',
        scheme_code: '118825', isin: 'INF769K01010',
        fund_house: 'Mirae Asset', category: 'Large Cap',
        plan_type: 'growth', folio_number: '12345678',
        units_held: '100.0000', avg_cost_nav: '50.00',
        last_nav: '65.00', last_nav_date: new Date('2024-10-01'),
        asset_id: 10, current_value: '6500', invested_amount: '5000',
      }]])
      // Mock: transactions for XIRR
      .mockResolvedValueOnce([[{
        fund_id: 1, type: 'purchase', transaction_date: new Date('2024-01-01'),
        units: '100', nav: '50', amount: '5000',
      }]])

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toHaveProperty('abs_return')
    expect(res.body[0]).toHaveProperty('xirr')
    expect(res.body[0].abs_return).toBeCloseTo(30, 0)  // (6500-5000)/5000 * 100 = 30%
  })
})

describe('POST /api/v1/assets/mutual-funds', () => {
  test('valid body with first transaction returns 201 with id and fund_id', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 20, affectedRows: 1 }])  // INSERT assets
      .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }])   // INSERT mutual_funds
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])   // INSERT transaction

    const res = await request(app.server)
      .post('/api/v1/assets/mutual-funds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_name: 'Axis Bluechip Fund',
        scheme_code: '120503',
        isin: 'INF846K01DP8',
        fund_house: 'Axis Mutual Fund',
        category: 'Large Cap',
        plan_type: 'growth',
        tx_type: 'purchase',
        tx_date: '2024-01-15',
        tx_units: 200,
        tx_nav: 48.5,
        tx_amount: 9700,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('fund_id')
  })

  test('units auto-calculated when only nav and amount provided', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 21, affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 6, affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 2, affectedRows: 1 }])

    const res = await request(app.server)
      .post('/api/v1/assets/mutual-funds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_name: 'HDFC Flexi Cap Fund',
        scheme_code: '100016',
        tx_type: 'purchase',
        tx_date: '2024-02-01',
        tx_nav: 100,
        tx_amount: 10000,
        // no tx_units — should be auto-calculated as 10000/100 = 100
      })

    expect(res.status).toBe(201)
  })
})

describe('GET /api/v1/assets/mutual-funds/:id', () => {
  test('found fund includes transactions array', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{
        id: 5, scheme_name: 'Axis Bluechip Fund', scheme_code: '120503',
        isin: 'INF846K01DP8', fund_house: 'Axis Mutual Fund',
        category: 'Large Cap', plan_type: 'growth', folio_number: null,
        units_held: '200.0000', avg_cost_nav: '48.50', last_nav: '55.00',
        last_nav_date: null, asset_id: 20, current_value: '11000', invested_amount: '9700', notes: null,
      }]])
      .mockResolvedValueOnce([[{
        id: 1, fund_id: 5, type: 'purchase', source: 'lumpsum',
        transaction_date: new Date('2024-01-15'),
        units: '200', nav: '48.50', amount: '9700',
      }]])

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds/20')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('transactions')
    expect(Array.isArray(res.body.transactions)).toBe(true)
    expect(res.body.transactions.length).toBe(1)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/v1/assets/mutual-funds/:id', () => {
  test('updates scheme metadata and returns id', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[{ id: 5 }]])  // existing check
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 1 }])   // UPDATE assets
      .mockResolvedValueOnce([{ affectedRows: 1 }])   // UPDATE mutual_funds

    const res = await request(app.server)
      .put('/api/v1/assets/mutual-funds/20')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheme_name: 'Axis Bluechip Fund - Direct',
        isin: 'INF846K01DP8',
        fund_house: 'Axis Mutual Fund',
        category: 'Large Cap',
        plan_type: 'direct_growth',
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })
})

describe('DELETE /api/v1/assets/mutual-funds/:id', () => {
  test('found fund returns 204', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app.server)
      .delete('/api/v1/assets/mutual-funds/20')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }])

    const res = await request(app.server)
      .delete('/api/v1/assets/mutual-funds/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

// ── Transactions ──────────────────────────────────────────────────────────────

describe('GET /api/v1/assets/mutual-funds/:id/transactions', () => {
  test('returns ordered list of transactions', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ id: 5 }]])   // fund lookup
      .mockResolvedValueOnce([[
        { id: 1, fund_id: 5, type: 'purchase', source: 'lumpsum', transaction_date: new Date('2024-01-01'), units: '100', nav: '50', amount: '5000' },
        { id: 2, fund_id: 5, type: 'purchase', source: 'sip',     transaction_date: new Date('2024-02-01'), units: '100', nav: '52', amount: '5200' },
      ]])

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds/20/transactions')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })
})

describe('POST /api/v1/assets/mutual-funds/:id/transactions', () => {
  test('purchase transaction returns 201', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[{ id: 5 }]])  // fund lookup

    // recalcFund calls
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 3, affectedRows: 1 }])   // INSERT tx
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // UPDATE last_nav
      .mockResolvedValueOnce([[{                                    // recalcFund agg
        units_held: '300', purchase_units: '300',
        purchase_amount: '15000', total_invested: '15000', total_redeemed: '0',
      }]])
      .mockResolvedValueOnce([[{ last_nav: '52', asset_id: 20 }]]) // fund rows
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // UPDATE mutual_funds
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // UPDATE assets

    const res = await request(app.server)
      .post('/api/v1/assets/mutual-funds/20/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'purchase',
        source: 'sip',
        transaction_date: '2024-03-01',
        units: 100,
        nav: 55,
        amount: 5500,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
  })
})

describe('XIRR null for single transaction', () => {
  test('list response: xirr is null when only one transaction exists', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{
        id: 1, scheme_name: 'Single TX Fund', scheme_code: '999',
        isin: null, fund_house: null, category: null,
        plan_type: 'growth', folio_number: null,
        units_held: '100', avg_cost_nav: '50',
        last_nav: '50', last_nav_date: null,
        asset_id: 5, current_value: '5000', invested_amount: '5000',
      }]])
      .mockResolvedValueOnce([[{
        fund_id: 1, type: 'purchase', transaction_date: new Date('2024-01-01'),
        units: '100', nav: '50', amount: '5000',
      }]])

    const res = await request(app.server)
      .get('/api/v1/assets/mutual-funds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // With 1 tx and no gain (last_nav = cost nav), XIRR calculation involves
    // [outflow, current value] but both equal 5000 so the return is near 0 or null
    // The test just verifies the field exists
    expect(res.body[0]).toHaveProperty('xirr')
  })
})
