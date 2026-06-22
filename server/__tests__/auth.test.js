'use strict'
/**
 * Auth route integration tests using supertest.
 * Mocks db and redis so no real MySQL/Redis connection is needed.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals')
const request = require('supertest')
const bcrypt = require('bcrypt')

// ── Mock the db and redis plugins before loading the app ──────────────────────

let mockExecute
let mockGetConnection
let mockConn

jest.mock('../src/plugins/db', () => {
  const fp = require('fastify-plugin')
  return fp(async (fastify) => {
    mockExecute = jest.fn()
    mockGetConnection = jest.fn()
    mockConn = {
      execute: jest.fn(),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    }
    mockGetConnection.mockResolvedValue(mockConn)
    const pool = { execute: mockExecute, getConnection: mockGetConnection }
    fastify.decorate('db', pool)
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
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const app = require('../src/app')

// ── helpers ───────────────────────────────────────────────────────────────────

async function getValidToken(userId = 1, email = 'test@example.com') {
  return app.jwt.sign({ id: userId, email }, { expiresIn: '15m' })
}

// ── test suite ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  // Reset mocks before each test
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

// ── POST /api/v1/auth/register ────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  test('happy path: valid credentials returns 201 with user and accessToken', async () => {
    // No existing user found
    mockExecute
      .mockResolvedValueOnce([[]])          // SELECT id FROM users (no existing)
      .mockResolvedValueOnce([{ insertId: 42, affectedRows: 1 }]) // INSERT users
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])  // INSERT user_profiles
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])  // INSERT refresh_tokens (storeRefreshToken fallback)

    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 42, affectedRows: 1 }]) // INSERT users
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }])  // INSERT user_profiles

    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ full_name: 'Rahul Sharma', email: 'rahul@example.com', password: 'securePass1' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user).toHaveProperty('email', 'rahul@example.com')
  })

  test('duplicate email returns 409', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 5 }]]) // existing user found

    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ full_name: 'Priya Singh', email: 'priya@example.com', password: 'securePass1' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already registered/i)
  })

  test('missing email returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ full_name: 'Amit', password: 'securePass1' })

    expect(res.status).toBe(400)
  })

  test('missing password returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ full_name: 'Amit', email: 'amit@example.com' })

    expect(res.status).toBe(400)
  })

  test('weak password (< 8 chars) returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ full_name: 'Amit', email: 'amit@example.com', password: 'short' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/8 characters/i)
  })

  test('missing full_name returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'validPass1' })

    expect(res.status).toBe(400)
  })
})

// ── POST /api/v1/auth/login ────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  test('happy path: correct credentials return 200 with accessToken', async () => {
    const hash = await bcrypt.hash('correctPass1', 10)
    mockExecute
      .mockResolvedValueOnce([[{
        id: 1, email: 'user@example.com', password_hash: hash, full_name: 'Test User',
      }]])
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }]) // INSERT refresh_tokens (storeRefreshToken fallback)

    const res = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'correctPass1' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body.user.email).toBe('user@example.com')
  })

  test('wrong password returns 401', async () => {
    const hash = await bcrypt.hash('correctPass1', 10)
    mockExecute.mockResolvedValueOnce([[{
      id: 1, email: 'user@example.com', password_hash: hash, full_name: 'Test',
    }]])

    const res = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'wrongPass1' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid/i)
  })

  test('non-existent email returns 401', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // no user found

    const res = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'somePass1' })

    expect(res.status).toBe(401)
  })

  test('missing email returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ password: 'pass1234' })

    expect(res.status).toBe(400)
  })

  test('missing password returns 400', async () => {
    const res = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com' })

    expect(res.status).toBe(400)
  })
})

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  test('without auth cookie returns 200 (logout is always safe)', async () => {
    const res = await request(app.server).post('/api/v1/auth/logout')
    // logout should succeed even without refresh token
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/logged out/i)
  })
})

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  test('without refresh token cookie returns 401', async () => {
    const res = await request(app.server).post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/no refresh token/i)
  })
})

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  test('with valid Bearer token returns 200 with user object', async () => {
    const token = await getValidToken(1, 'rahul@example.com')
    mockExecute.mockResolvedValueOnce([[{
      id: 1, email: 'rahul@example.com', full_name: 'Rahul Sharma', dob: null, risk_profile: null,
    }]])

    const res = await request(app.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('email', 'rahul@example.com')
    expect(res.body).toHaveProperty('full_name')
  })

  test('without token returns 401', async () => {
    const res = await request(app.server).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })

  test('with invalid/malformed token returns 401', async () => {
    const res = await request(app.server)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token')
    expect(res.status).toBe(401)
  })
})
