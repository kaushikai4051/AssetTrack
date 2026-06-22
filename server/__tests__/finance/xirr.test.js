'use strict'
/**
 * Tests for server/src/finance/xirr.js
 * Newton-Raphson XIRR solver.
 */

const { xirr } = require('../../src/finance/xirr')

describe('xirr', () => {
  test('simple 1-year investment at ~10% XIRR', () => {
    // Invest 10000 on day 0, get back 11000 exactly 1 year later
    const cashflows = [-10000, 11000]
    const d0 = new Date('2024-01-01')
    const d1 = new Date('2025-01-01')
    const result = xirr(cashflows, [d0, d1])
    expect(result).not.toBeNull()
    // Should be close to 0.10 (10%)
    expect(result).toBeGreaterThan(0.095)
    expect(result).toBeLessThan(0.105)
  })

  test('SIP-like pattern — multiple purchases then single redemption', () => {
    // Three monthly SIP instalments of 5000 each, then 16500 returned ~3 months later
    const cashflows = [-5000, -5000, -5000, 16500]
    const dates = [
      new Date('2024-01-01'),
      new Date('2024-02-01'),
      new Date('2024-03-01'),
      new Date('2024-07-01'),
    ]
    const result = xirr(cashflows, dates)
    expect(result).not.toBeNull()
    // Should be a positive return
    expect(result).toBeGreaterThan(0)
  })

  test('negative return scenario', () => {
    // Invest 10000, get back only 9000 after 1 year → negative XIRR
    const cashflows = [-10000, 9000]
    const dates = [new Date('2024-01-01'), new Date('2025-01-01')]
    const result = xirr(cashflows, dates)
    expect(result).not.toBeNull()
    expect(result).toBeLessThan(0)
    expect(result).toBeGreaterThan(-0.2)
  })

  test('returns null for single cashflow', () => {
    const result = xirr([-10000], [new Date('2024-01-01')])
    expect(result).toBeNull()
  })

  test('returns null when all cashflows are outflows (no positive inflow)', () => {
    const result = xirr([-5000, -5000], [new Date('2024-01-01'), new Date('2024-06-01')])
    expect(result).toBeNull()
  })

  test('returns null when all cashflows are inflows (no negative outflow)', () => {
    const result = xirr([5000, 5000], [new Date('2024-01-01'), new Date('2024-06-01')])
    expect(result).toBeNull()
  })

  test('Mirae Asset Bluechip SIP — realistic scenario', () => {
    // 12 monthly SIPs of 2000 each, current value 26000 after ~1 year
    const cashflows = [
      -2000, -2000, -2000, -2000, -2000, -2000,
      -2000, -2000, -2000, -2000, -2000, -2000,
      26000,
    ]
    const dates = []
    for (let i = 0; i < 12; i++) {
      const d = new Date('2024-01-01')
      d.setMonth(d.getMonth() + i)
      dates.push(d)
    }
    dates.push(new Date('2025-02-01'))

    const result = xirr(cashflows, dates)
    expect(result).not.toBeNull()
    // Slight gain on 24000 invested → positive XIRR
    expect(result).toBeGreaterThan(0)
  })

  test('high return scenario', () => {
    // Invest 100000, get back 150000 after 1 year → ~50% XIRR
    const cashflows = [-100000, 150000]
    const dates = [new Date('2024-01-01'), new Date('2025-01-01')]
    const result = xirr(cashflows, dates)
    expect(result).not.toBeNull()
    expect(result).toBeGreaterThan(0.45)
    expect(result).toBeLessThan(0.55)
  })

  test('result is rounded to 4 decimal places', () => {
    const cashflows = [-10000, 11000]
    const dates = [new Date('2024-01-01'), new Date('2025-01-01')]
    const result = xirr(cashflows, dates)
    // Should be a number with at most 4 decimal places
    expect(String(result).replace('.', '').length).toBeLessThanOrEqual(6)
  })
})
