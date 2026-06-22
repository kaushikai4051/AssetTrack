'use strict'
/**
 * Stocks route tests.
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

describe('POST /api/v1/assets/stocks', () => {
  test('valid body returns 201 with id and holding_id', async () => {
    const token = await getToken()
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 50, affectedRows: 1 }])  // INSERT assets
      .mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }])  // INSERT stock_holdings
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])   // INSERT stock_transaction

    const res = await request(app.server)
      .post('/api/v1/assets/stocks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ticker: 'RELIANCE',
        company_name: 'Reliance Industries Ltd',
        exchange: 'NSE',
        sector: 'Energy',
        isin: 'INE002A01018',
        broker: 'Zerodha',
        tx_date: '2024-01-10',
        tx_shares: 10,
        tx_price: 2500,
        tx_brokerage: 25,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('holding_id')
  })
})

describe('GET /api/v1/assets/stocks', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/assets/stocks')
    expect(res.status).toBe(401)
  })

  test('empty holdings returns empty array', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .get('/api/v1/assets/stocks')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('non-empty list includes P&L fields', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{
        id: 10, ticker: 'RELIANCE', company_name: 'Reliance Industries Ltd',
        exchange: 'NSE', sector: 'Energy', isin: 'INE002A01018',
        broker: 'Zerodha', shares_held: '10', avg_cost_price: '2500',
        last_price: '2800', last_price_date: new Date('2024-10-01'),
        asset_id: 50, current_value: '28000', invested_amount: '25000',
      }]])
      .mockResolvedValueOnce([[{
        holding_id: 10, type: 'buy', transaction_date: new Date('2024-01-10'),
        shares: '10', price: '2500', brokerage: '25', amount: '25025',
      }]])

    const res = await request(app.server)
      .get('/api/v1/assets/stocks')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0]).toHaveProperty('pnl')
    expect(res.body[0]).toHaveProperty('pnl_pct')
    expect(res.body[0]).toHaveProperty('ltcg_shares')
    expect(res.body[0]).toHaveProperty('stcg_shares')
    expect(res.body[0].pnl).toBe(3000)  // 28000 - 25000
  })
})

describe('GET /api/v1/assets/stocks/:id', () => {
  test('found holding returns lots/transactions array', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{
        id: 10, ticker: 'TCS', company_name: 'Tata Consultancy Services',
        exchange: 'NSE', sector: 'IT', isin: 'INE467B01029',
        broker: 'Groww', shares_held: '5', avg_cost_price: '3500',
        last_price: '4000', last_price_date: null,
        asset_id: 51, current_value: '20000', invested_amount: '17500', notes: null,
      }]])
      .mockResolvedValueOnce([[{
        id: 1, holding_id: 10, type: 'buy',
        transaction_date: new Date('2024-03-01'),
        shares: '5', price: '3500', amount: '17500', brokerage: '0',
      }]])

    const res = await request(app.server)
      .get('/api/v1/assets/stocks/51')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('transactions')
    expect(res.body.transactions.length).toBe(1)
  })

  test('not found returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await request(app.server)
      .get('/api/v1/assets/stocks/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/assets/stocks/:id/transactions', () => {
  test('BUY transaction returns 201', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[{ id: 10 }]])  // holding lookup

    // recalcHolding calls
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }])  // INSERT tx
      .mockResolvedValueOnce([[                                    // recalcHolding: all txns
        { type: 'buy', transaction_date: new Date('2024-01-10'), shares: '10', price: '2500', brokerage: '25' },
        { type: 'buy', transaction_date: new Date('2024-06-01'), shares: '5', price: '2700', brokerage: '15' },
      ]])
      .mockResolvedValueOnce([[{ last_price: '2800', asset_id: 50 }]])  // holding row
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE stock_holdings
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE assets

    const res = await request(app.server)
      .post('/api/v1/assets/stocks/50/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'buy',
        transaction_date: '2024-06-01',
        shares: 5,
        price: 2700,
        brokerage: 15,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
  })

  test('not found holding returns 404', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])  // no holding

    const res = await request(app.server)
      .post('/api/v1/assets/stocks/999/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'buy', transaction_date: '2024-06-01', shares: 5, price: 2700 })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/assets/stocks/:id/transactions/:txId', () => {
  test('found transaction returns 204', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[{ id: 10 }]])  // holding lookup

    mockConn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])    // DELETE tx
      .mockResolvedValueOnce([[                         // recalcHolding: remaining txns
        { type: 'buy', transaction_date: new Date('2024-01-10'), shares: '10', price: '2500', brokerage: '25' },
      ]])
      .mockResolvedValueOnce([[{ last_price: '2800', asset_id: 50 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app.server)
      .delete('/api/v1/assets/stocks/50/transactions/5')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })
})
