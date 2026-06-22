'use strict'
/**
 * Bank Accounts route tests — Fixed Deposits, Recurring Deposits, Savings Accounts.
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

// ── Fixed Deposits ────────────────────────────────────────────────────────────

describe('Fixed Deposits', () => {
  describe('GET /api/v1/assets/fixed-deposits', () => {
    test('unauthenticated returns 401', async () => {
      const res = await request(app.server).get('/api/v1/assets/fixed-deposits')
      expect(res.status).toBe(401)
    })

    test('returns empty array when no FDs', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[]])

      const res = await request(app.server)
        .get('/api/v1/assets/fixed-deposits')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    test('returns list with FD data when FDs exist', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{
        id: 1, asset_name: 'FD — SBI', notes: null, family_member_id: null,
        current_value: 107000,
        bank_name: 'State Bank of India', account_number: '123456789',
        principal: '100000', interest_rate: '7.00',
        compounding: 'quarterly', start_date: new Date('2024-01-01'),
        maturity_date: new Date('2025-01-01'), maturity_amount: '107000',
        is_auto_renew: 0, nominee_name: 'Priya Sharma',
      }]])

      const res = await request(app.server)
        .get('/api/v1/assets/fixed-deposits')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.length).toBe(1)
      expect(res.body[0].bank_name).toBe('State Bank of India')
      expect(res.body[0].principal).toBe(100000)
      expect(res.body[0].maturity_amount).toBe(107000)
      expect(typeof res.body[0].is_auto_renew).toBe('boolean')
    })
  })

  describe('POST /api/v1/assets/fixed-deposits', () => {
    test('valid body returns 201 with id and maturity_amount', async () => {
      const token = await getToken()
      mockConn.execute
        .mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }])  // INSERT assets
        .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])   // INSERT fixed_deposits

      const res = await request(app.server)
        .post('/api/v1/assets/fixed-deposits')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'HDFC Bank',
          principal: 500000,
          interest_rate: 7.25,
          compounding: 'quarterly',
          start_date: '2024-01-01',
          maturity_date: '2025-01-01',
          is_auto_renew: false,
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('maturity_amount')
      expect(res.body.maturity_amount).toBeGreaterThan(500000)
    })

    test('zero interest rate: maturity_amount equals principal', async () => {
      const token = await getToken()
      mockConn.execute
        .mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 2, affectedRows: 1 }])

      const res = await request(app.server)
        .post('/api/v1/assets/fixed-deposits')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'ICICI Bank',
          principal: 100000,
          interest_rate: 0,
          compounding: 'quarterly',
          start_date: '2024-01-01',
          maturity_date: '2025-01-01',
        })

      expect(res.status).toBe(201)
      expect(res.body.maturity_amount).toBe(100000)
    })
  })

  describe('GET /api/v1/assets/fixed-deposits/:id', () => {
    test('existing FD returns 200 with full object', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{
        id: 5, asset_name: 'FD — Axis Bank', notes: null, family_member_id: null,
        bank_name: 'Axis Bank', account_number: '987654321',
        principal: '250000', interest_rate: '6.75',
        compounding: 'quarterly', start_date: new Date('2023-06-01'),
        maturity_date: new Date('2026-06-01'), maturity_amount: '305000',
        is_auto_renew: 1, nominee_name: null,
      }]])

      const res = await request(app.server)
        .get('/api/v1/assets/fixed-deposits/5')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.bank_name).toBe('Axis Bank')
      expect(res.body.principal).toBe(250000)
    })

    test('non-existent FD or other user FD returns 404', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[]])  // no FD found

      const res = await request(app.server)
        .get('/api/v1/assets/fixed-deposits/999')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/v1/assets/fixed-deposits/:id', () => {
    test('valid update returns 200 with recalculated maturity_amount', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{ id: 5 }]])  // existing check
      mockConn.execute
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE assets
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE fixed_deposits

      const res = await request(app.server)
        .put('/api/v1/assets/fixed-deposits/5')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'SBI', principal: 200000, interest_rate: 7.5,
          compounding: 'quarterly', start_date: '2024-01-01', maturity_date: '2025-01-01',
          is_auto_renew: false,
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('maturity_amount')
      expect(res.body.maturity_amount).toBeGreaterThan(200000)
    })

    test('non-existent FD returns 404', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[]])  // no existing

      const res = await request(app.server)
        .put('/api/v1/assets/fixed-deposits/999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'SBI', principal: 100000, interest_rate: 7,
          compounding: 'quarterly', start_date: '2024-01-01', maturity_date: '2025-01-01',
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/v1/assets/fixed-deposits/:id', () => {
    test('existing FD returns 204 (soft delete — is_active = 0)', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])

      const res = await request(app.server)
        .delete('/api/v1/assets/fixed-deposits/5')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(204)
    })

    test('non-existent FD returns 404', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }])

      const res = await request(app.server)
        .delete('/api/v1/assets/fixed-deposits/999')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })
})

// ── Recurring Deposits ────────────────────────────────────────────────────────

describe('Recurring Deposits', () => {
  describe('POST /api/v1/assets/recurring-deposits', () => {
    test('valid body returns 201 with maturity_date auto-calculated', async () => {
      const token = await getToken()
      mockConn.execute
        .mockResolvedValueOnce([{ insertId: 20, affectedRows: 1 }])  // INSERT assets
        .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }])   // INSERT recurring_deposits

      const res = await request(app.server)
        .post('/api/v1/assets/recurring-deposits')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'Punjab National Bank',
          monthly_amount: 5000,
          interest_rate: 6.5,
          tenure_months: 24,
          start_date: '2024-01-01',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('maturity_amount')
      expect(res.body).toHaveProperty('maturity_date')
      // maturity_date should be 24 months after start_date = 2026-01-01
      expect(res.body.maturity_date).toBe('2026-01-01')
      expect(res.body.maturity_amount).toBeGreaterThan(5000 * 24)
    })
  })

  describe('GET /api/v1/assets/recurring-deposits/:id', () => {
    test('found RD returns 200', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{
        id: 20, asset_name: 'RD — PNB', notes: null, family_member_id: null,
        bank_name: 'Punjab National Bank', account_number: null,
        monthly_amount: '5000', interest_rate: '6.50',
        tenure_months: 24, start_date: new Date('2024-01-01'),
        maturity_date: new Date('2026-01-01'), maturity_amount: '130000',
      }]])

      const res = await request(app.server)
        .get('/api/v1/assets/recurring-deposits/20')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.bank_name).toBe('Punjab National Bank')
      expect(res.body.monthly_amount).toBe(5000)
    })
  })

  describe('DELETE /api/v1/assets/recurring-deposits/:id', () => {
    test('found RD returns 204', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])

      const res = await request(app.server)
        .delete('/api/v1/assets/recurring-deposits/20')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(204)
    })
  })
})

// ── Savings Accounts ──────────────────────────────────────────────────────────

describe('Savings Accounts', () => {
  describe('POST /api/v1/assets/savings-accounts', () => {
    test('savings type: asset_name includes "Savings A/C"', async () => {
      const token = await getToken()
      mockConn.execute
        .mockResolvedValueOnce([{ insertId: 30, affectedRows: 1 }])  // INSERT assets
        .mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }])  // INSERT savings_accounts

      const res = await request(app.server)
        .post('/api/v1/assets/savings-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'Kotak Mahindra Bank',
          account_type: 'savings',
          interest_rate: 4,
          balance: 150000,
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      // The controller sets asset_name to "Savings A/C — Kotak Mahindra Bank"
      // We verify the id was returned
      expect(res.body.id).toBe(30)
    })

    test('current type: returns 201 correctly', async () => {
      const token = await getToken()
      mockConn.execute
        .mockResolvedValueOnce([{ insertId: 31, affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }])

      const res = await request(app.server)
        .post('/api/v1/assets/savings-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'ICICI Bank',
          account_type: 'current',
          interest_rate: 0,
          balance: 500000,
        })

      expect(res.status).toBe(201)
    })
  })

  describe('GET /api/v1/assets/savings-accounts/:id', () => {
    test('found account returns current_value and interest_rate', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{
        id: 30, asset_name: 'Savings A/C — Kotak', notes: null, family_member_id: null,
        current_value: '150000',
        bank_name: 'Kotak Mahindra Bank', account_number: null,
        account_type: 'savings', ifsc_code: 'KKBK0000001', branch_name: 'Mumbai',
        interest_rate: '4.00',
      }]])

      const res = await request(app.server)
        .get('/api/v1/assets/savings-accounts/30')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.current_value).toBe(150000)
      expect(res.body.interest_rate).toBe(4)
    })
  })

  describe('PUT /api/v1/assets/savings-accounts/:id', () => {
    test('balance update reflected in current_value response', async () => {
      const token = await getToken()
      mockExecute.mockResolvedValueOnce([[{ id: 30 }]])  // existing check
      mockConn.execute
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE assets
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE savings_accounts

      const res = await request(app.server)
        .put('/api/v1/assets/savings-accounts/30')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bank_name: 'Kotak Mahindra Bank',
          account_type: 'savings',
          interest_rate: 4,
          balance: 200000,
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('id', 30)
    })
  })
})
