'use strict'
/**
 * Factory that returns a mock MySQL connection pool.
 * Avoids real MySQL connection during tests.
 */

const { jest } = require('@jest/globals')

function createMockDb(overrides = {}) {
  const mockConn = {
    execute: jest.fn().mockResolvedValue([[], {}]),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockReturnValue(undefined),
    ...overrides.conn,
  }

  const mockPool = {
    execute: jest.fn().mockResolvedValue([[], {}]),
    query: jest.fn().mockResolvedValue([[], {}]),
    getConnection: jest.fn().mockResolvedValue(mockConn),
    ...overrides.pool,
  }

  return { pool: mockPool, conn: mockConn }
}

module.exports = { createMockDb }
