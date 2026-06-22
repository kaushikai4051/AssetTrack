'use strict'
/**
 * Gold route tests.
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

describe('POST /api/v1/assets/gold', () => {
  test('physical gold: stores weight, purity, purchase_price_per_gram', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 100, affectedRows: 1 }])  // INSERT assets
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])    // INSERT gold_holdings

    const res = await request(app.server)
      .post('/api/v1/assets/gold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gold_type: 'physical',
        name: '22k Gold Coin 10g',
        quantity: 10,
        purity: '22k',
        purchase_price: 6200,
        purchase_date: '2024-01-01',
        storage_location: 'Bank Locker',
        notes: 'Gifted for Diwali',
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })

  test('ETF gold: stores units and nav', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 2, affectedRows: 1 }])

    const res = await request(app.server)
      .post('/api/v1/assets/gold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gold_type: 'etf',
        name: 'GOLDBEES',
        quantity: 50,
        ticker: 'GOLDBEES',
        broker: 'Zerodha',
        purchase_price: 55,
        purchase_date: '2024-03-15',
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })

  test('SGB: stores issue_date, maturity_date, interest_rate', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 3, affectedRows: 1 }])

    const res = await request(app.server)
      .post('/api/v1/assets/gold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gold_type: 'sgb',
        name: 'SGB 2023-24 Series I',
        quantity: 10,
        sgb_series: 'SGB 2023-24 Series I',
        face_value: 5923,
        issue_date: '2023-11-27',
        maturity_date: '2031-11-27',
        coupon_rate: 2.50,
        purchase_price: 5923,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })

  test('Digital gold: stores platform', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 103, affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 4, affectedRows: 1 }])

    const res = await request(app.server)
      .post('/api/v1/assets/gold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gold_type: 'digital',
        name: 'MMTC-PAMP Digital Gold',
        quantity: 2.5,
        platform: 'MMTC-PAMP',
        purchase_price: 6100,
        purchase_date: '2024-05-01',
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('asset_id')
  })
})

describe('GET /api/v1/assets/gold', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/assets/gold')
    expect(res.status).toBe(401)
  })

  test('returns all types with pnl fields', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[
      {
        asset_id: 100, gold_type: 'physical', name: '22k Gold Coin',
        quantity: '10', purchase_price: '6200', purity: '22k',
        current_value: '56754', invested_amount: '56754',
        platform: null, ticker: null, sgb_series: null, notes: null,
        last_price: null, last_price_date: null,
        face_value: null, issue_date: null, maturity_date: null, coupon_rate: null,
        storage_location: 'Bank Locker',
      },
    ]])

    const res = await request(app.server)
      .get('/api/v1/assets/gold')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toHaveProperty('pnl')
    expect(res.body[0]).toHaveProperty('pnl_pct')
    expect(res.body[0].gold_type).toBe('physical')
  })
})

describe('PUT /api/v1/assets/gold/:id', () => {
  test('updates and returns success', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[{ gold_type: 'physical', last_price: '6500' }]])  // holding lookup
    mockConn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE assets
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE gold_holdings

    const res = await request(app.server)
      .put('/api/v1/assets/gold/100')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '22k Gold Coin 10g',
        quantity: 12,
        purity: '22k',
        purchase_price: 6200,
        purchase_date: '2024-01-01',
        storage_location: 'Bank Locker',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .put('/api/v1/assets/gold/999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gold', quantity: 10, purity: '22k', purchase_price: 6000 })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/assets/gold/:id', () => {
  test('found gold holding returns 200 (soft delete)', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ asset_id: 100 }]])  // SELECT to verify ownership
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE assets SET is_active=0

    const res = await request(app.server)
      .delete('/api/v1/assets/gold/100')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .delete('/api/v1/assets/gold/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
