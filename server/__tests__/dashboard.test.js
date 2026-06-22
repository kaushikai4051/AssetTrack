'use strict'
/**
 * Dashboard route tests.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals')
const request = require('supertest')

let mockExecute

jest.mock('../src/plugins/db', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    mockExecute = jest.fn()
    fastify.decorate('db', { execute: mockExecute, getConnection: jest.fn() })
  })
})

jest.mock('../src/plugins/redis', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    fastify.decorate('redis', {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    })
    fastify.decorate('redisAvailable', false)
  })
})

process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = require('../src/app')

beforeAll(async () => { await app.ready() })
afterAll(async () => { await app.close() })
beforeEach(() => { jest.clearAllMocks(); if (mockExecute) mockExecute.mockReset() })

async function getToken(userId = 1) {
  return app.jwt.sign({ id: userId, email: 'user@example.com' }, { expiresIn: '15m' })
}

describe('GET /api/v1/dashboard/summary', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/dashboard/summary')
    expect(res.status).toBe(401)
  })

  test('user with no assets returns zero values', async () => {
    const token = await getToken()
    // Simulate three DB calls: assets sum, liabilities sum, count
    mockExecute
      .mockResolvedValueOnce([[{ total: 0, invested: 0 }]])  // asset sum
      .mockResolvedValueOnce([[{ total: 0 }]])                // liability sum
      .mockResolvedValueOnce([[{ cnt: 0 }]])                  // count

    const res = await request(app.server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.netWorth).toBe(0)
    expect(res.body.totalAssets).toBe(0)
    expect(res.body.totalLiabilities).toBe(0)
    expect(res.body.assetCount).toBe(0)
    expect(res.body).toHaveProperty('upcomingEvents')
  })

  test('user with assets returns calculated net worth', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ total: 500000, invested: 400000 }]])  // assets
      .mockResolvedValueOnce([[{ total: 0 }]])                          // liabilities
      .mockResolvedValueOnce([[{ cnt: 3 }]])                            // count

    const res = await request(app.server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.netWorth).toBe(500000)
    expect(res.body.totalAssets).toBe(500000)
    expect(res.body.totalInvested).toBe(400000)
    expect(res.body.totalGain).toBe(100000)
    expect(res.body.assetCount).toBe(3)
  })

  test('user with assets and liabilities: netWorth = assets - liabilities', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ total: 1000000, invested: 800000 }]])  // assets
      .mockResolvedValueOnce([[{ total: 200000 }]])                      // liabilities
      .mockResolvedValueOnce([[{ cnt: 5 }]])                             // count

    const res = await request(app.server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.netWorth).toBe(800000)
    expect(res.body.totalLiabilities).toBe(200000)
  })

  test('overall return percentage is calculated correctly', async () => {
    const token = await getToken()
    mockExecute
      .mockResolvedValueOnce([[{ total: 110000, invested: 100000 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ cnt: 1 }]])

    const res = await request(app.server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.overallReturn).toBeCloseTo(10, 1)
  })
})

describe('GET /api/v1/dashboard/upcoming-events', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/dashboard/upcoming-events')
    expect(res.status).toBe(401)
  })

  test('authenticated returns events array', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[]])  // no FD maturities in next 60 days

    const res = await request(app.server)
      .get('/api/v1/dashboard/upcoming-events')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('events')
    expect(Array.isArray(res.body.events)).toBe(true)
  })
})

describe('GET /api/v1/dashboard/top-holdings', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/dashboard/top-holdings')
    expect(res.status).toBe(401)
  })

  test('returns holdings array', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValueOnce([[
      { asset_name: 'FD — SBI', asset_type: 'fixed_deposit', current_value: 500000 },
    ]])

    const res = await request(app.server)
      .get('/api/v1/dashboard/top-holdings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('holdings')
    expect(res.body.holdings.length).toBeGreaterThan(0)
  })
})
