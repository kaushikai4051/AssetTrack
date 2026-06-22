'use strict'
/**
 * Builds a Fastify test instance with mocked db and redis.
 * Usage:
 *   const { app, mockDb, mockConn } = await buildApp()
 *   // override mockDb.pool.execute.mockResolvedValue([...]) before calling routes
 *   await app.close()
 */

const { jest } = require('@jest/globals')
const { createMockDb } = require('./mockDb')

async function buildApp(dbOverrides = {}) {
  // Isolate env
  process.env.NODE_ENV = 'test'
  process.env.JWT_ACCESS_SECRET = 'test-access-secret'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
  process.env.JWT_ACCESS_EXPIRY = '15m'

  // Build mock db + redis
  const { pool: mockPool, conn: mockConn } = createMockDb(dbOverrides)

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }

  // Stub out DB + Redis plugins before loading app
  // We mock the plugin files so Fastify never tries to connect
  jest.mock('../../src/plugins/db', () => {
    const fp = require('fastify-plugin')
    return fp(async (fastify) => {
      fastify.decorate('db', mockPool)
    })
  })

  jest.mock('../../src/plugins/redis', () => {
    const fp = require('fastify-plugin')
    return fp(async (fastify) => {
      fastify.decorate('redis', mockRedis)
      fastify.decorate('redisAvailable', false) // disable redis caching in tests
    })
  })

  const app = require('../../src/app')
  await app.ready()

  return { app, mockPool, mockConn, mockRedis }
}

module.exports = { buildApp }
