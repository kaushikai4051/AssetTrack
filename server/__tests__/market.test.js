'use strict'
/**
 * Market data route tests.
 * External HTTP calls (getNav, getStockPrice, getGoldPrice) are mocked.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals')
const request = require('supertest')

let mockExecute

// Mock external market data services
jest.mock('../src/market/mfNav', () => ({
  getNav:        jest.fn(),
  searchFunds:   jest.fn(),
}))
jest.mock('../src/market/stockPrice', () => ({
  getStockPrice: jest.fn(),
}))
jest.mock('../src/market/goldPrice', () => ({
  getGoldPrice:  jest.fn(),
}))

jest.mock('../src/plugins/db', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    mockExecute = jest.fn().mockResolvedValue([{ affectedRows: 0 }])
    fastify.decorate('db', { execute: mockExecute, getConnection: jest.fn() })
  })
})

jest.mock('../src/plugins/redis', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    fastify.decorate('redis', { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() })
    fastify.decorate('redisAvailable', false)
  })
})

process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = require('../src/app')
const { getNav, searchFunds }  = require('../src/market/mfNav')
const { getStockPrice }        = require('../src/market/stockPrice')
const { getGoldPrice }         = require('../src/market/goldPrice')

beforeAll(async () => { await app.ready() })
afterAll(async () => { await app.close() })
beforeEach(() => {
  jest.clearAllMocks()
  if (mockExecute) mockExecute.mockResolvedValue([{ affectedRows: 0 }])
})

async function getToken(userId = 1) {
  return app.jwt.sign({ id: userId, email: 'user@example.com' }, { expiresIn: '15m' })
}

// ── MF NAV ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/market/mf-nav/:schemeCode', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/market/mf-nav/120503')
    expect(res.status).toBe(401)
  })

  test('valid scheme code returns nav, date, scheme_name', async () => {
    const token = await getToken()
    getNav.mockResolvedValueOnce({
      nav: 65.48,
      date: '2024-10-01',
      scheme_name: 'Axis Bluechip Fund - Growth',
      scheme_code: '120503',
    })

    const res = await request(app.server)
      .get('/api/v1/market/mf-nav/120503')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('nav')
    expect(res.body).toHaveProperty('date')
    expect(res.body).toHaveProperty('scheme_name')
    expect(res.body.nav).toBe(65.48)
  })

  test('upstream error returns 502', async () => {
    const token = await getToken()
    getNav.mockRejectedValueOnce(new Error('AMFI server unavailable'))

    const res = await request(app.server)
      .get('/api/v1/market/mf-nav/999999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(502)
    expect(res.body).toHaveProperty('message')
  })
})

// ── MF Search ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/market/mf-search', () => {
  test('query < 3 chars returns empty array', async () => {
    const token = await getToken()
    const res = await request(app.server)
      .get('/api/v1/market/mf-search?q=ax')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('valid query returns fund search results', async () => {
    const token = await getToken()
    searchFunds.mockResolvedValueOnce([
      { scheme_code: '120503', scheme_name: 'Axis Bluechip Fund - Growth' },
      { scheme_code: '120504', scheme_name: 'Axis Bluechip Fund - IDCW' },
    ])

    const res = await request(app.server)
      .get('/api/v1/market/mf-search?q=axis')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })
})

// ── Stock Price ───────────────────────────────────────────────────────────────

describe('GET /api/v1/market/stock-price/:ticker', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/market/stock-price/RELIANCE')
    expect(res.status).toBe(401)
  })

  test('valid ticker returns price, exchange, timestamp', async () => {
    const token = await getToken()
    getStockPrice.mockResolvedValueOnce({
      price: 2812.50,
      exchange: 'NSE',
      ticker: 'RELIANCE',
      timestamp: '2024-10-01T10:30:00.000Z',
    })

    const res = await request(app.server)
      .get('/api/v1/market/stock-price/RELIANCE')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('price')
    expect(res.body).toHaveProperty('exchange')
    expect(res.body.price).toBe(2812.50)
  })

  test('upstream error returns 502', async () => {
    const token = await getToken()
    getStockPrice.mockRejectedValueOnce(new Error('Yahoo Finance rate limited'))

    const res = await request(app.server)
      .get('/api/v1/market/stock-price/UNKNOWNTICKER')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(502)
  })
})

// ── Gold Price ────────────────────────────────────────────────────────────────

describe('GET /api/v1/market/gold-price', () => {
  test('unauthenticated returns 401', async () => {
    const res = await request(app.server).get('/api/v1/market/gold-price')
    expect(res.status).toBe(401)
  })

  test('returns price_per_gram_24k, currency, timestamp', async () => {
    const token = await getToken()
    mockExecute.mockResolvedValue([[]])  // no holdings to update

    getGoldPrice.mockResolvedValueOnce({
      price_per_gram: 7250.00,
      price_per_gram_24k: 7250.00,
      currency: 'INR',
      timestamp: '2024-10-01T09:00:00.000Z',
    })

    const res = await request(app.server)
      .get('/api/v1/market/gold-price')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('price_per_gram')
    expect(res.body.price_per_gram).toBe(7250.00)
  })

  test('upstream error returns 502', async () => {
    const token = await getToken()
    getGoldPrice.mockRejectedValueOnce(new Error('Gold price API unavailable'))

    const res = await request(app.server)
      .get('/api/v1/market/gold-price')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(502)
  })
})
