'use strict'
/**
 * Tests for server/src/finance/fd.js
 * Pure function tests — no DB or HTTP layer needed.
 */

const { calcFDMaturity, calcRDMaturity } = require('../../src/finance/fd')

// ── calcFDMaturity ────────────────────────────────────────────────────────────

describe('calcFDMaturity', () => {
  test('quarterly compounding for 1 year at 7% increases principal', () => {
    const result = calcFDMaturity(100000, 7, 'quarterly', '2024-01-01', '2025-01-01')
    // P*(1+r/4)^4 = 100000*(1+0.07/4)^4 ≈ 107185.90
    expect(result).toBeGreaterThan(100000)
    expect(result).toBeCloseTo(107185.9, -2)
  })

  test('simple interest compounding gives P*(1+r*t)', () => {
    // 2 years at 10% simple = 100000 * (1 + 0.10 * 2) = 120000
    const result = calcFDMaturity(100000, 10, 'simple', '2023-01-01', '2025-01-01')
    expect(result).toBeGreaterThan(100000)
    expect(result).toBeCloseTo(120000, -2) // allow day-accurate arithmetic to differ slightly
  })

  test('monthly compounding for 1 year at 8%', () => {
    const result = calcFDMaturity(50000, 8, 'monthly', '2024-01-01', '2025-01-01')
    // 50000*(1+0.08/12)^12 ≈ 54150
    expect(result).toBeGreaterThan(50000)
    expect(result).toBeCloseTo(54150, -2)
  })

  test('yearly compounding for 2 years at 9%', () => {
    const result = calcFDMaturity(100000, 9, 'yearly', '2022-01-01', '2024-01-01')
    // 100000*(1+0.09)^2 = 118810
    expect(result).toBeGreaterThan(100000)
    expect(result).toBeCloseTo(118810, -2)
  })

  test('half-yearly compounding for 1 year at 6%', () => {
    const result = calcFDMaturity(100000, 6, 'half_yearly', '2024-01-01', '2025-01-01')
    // 100000*(1+0.06/2)^2 = 100000*1.0609 = 106090
    expect(result).toBeCloseTo(106090, -2)
  })

  test('zero rate returns principal unchanged', () => {
    const result = calcFDMaturity(200000, 0, 'quarterly', '2024-01-01', '2026-01-01')
    expect(result).toBe(200000)
  })

  test('maturity_date same as start_date returns principal', () => {
    const result = calcFDMaturity(100000, 7, 'quarterly', '2024-06-01', '2024-06-01')
    expect(result).toBe(100000)
  })

  test('handles SBI-style FD: 500000 at 6.8% quarterly for 1 year', () => {
    const result = calcFDMaturity(500000, 6.8, 'quarterly', '2024-04-01', '2025-04-01')
    expect(result).toBeGreaterThan(500000)
    // Approx maturity: 500000 * (1 + 0.068/4)^4 ≈ 535137
    expect(result).toBeGreaterThan(530000)
    expect(result).toBeLessThan(540000)
  })

  test('HDFC Bank FD: 1000000 at 7.25% for 3 years quarterly', () => {
    const result = calcFDMaturity(1000000, 7.25, 'quarterly', '2022-01-01', '2025-01-01')
    expect(result).toBeGreaterThan(1000000)
    // (1 + 0.0725/4)^12 ≈ 1.239 → 1239xxx
    expect(result).toBeGreaterThan(1200000)
  })
})

// ── calcRDMaturity ────────────────────────────────────────────────────────────

describe('calcRDMaturity', () => {
  test('12 months at 6% returns more than total deposits', () => {
    const monthly = 5000
    const months = 12
    const result = calcRDMaturity(monthly, 6, months)
    expect(result).toBeGreaterThan(monthly * months)
    // Expected ≈ 61683 for 5000/month at 6% for 12m
    expect(result).toBeGreaterThan(60000)
    expect(result).toBeLessThan(65000)
  })

  test('zero interest rate returns exactly total deposits', () => {
    const result = calcRDMaturity(10000, 0, 24)
    expect(result).toBe(10000 * 24)
  })

  test('single month deposit', () => {
    const result = calcRDMaturity(5000, 6, 1)
    // FV of a single deposit compounded for 1 period
    expect(result).toBeGreaterThan(5000)
    expect(result).toBeCloseTo(5025, 0)
  })

  test('SBI RD: 3000/month at 7% for 24 months', () => {
    const result = calcRDMaturity(3000, 7, 24)
    expect(result).toBeGreaterThan(3000 * 24) // 72000
    expect(result).toBeGreaterThan(75000)
  })

  test('post office RD: 1000/month at 6.5% for 60 months', () => {
    const result = calcRDMaturity(1000, 6.5, 60)
    expect(result).toBeGreaterThan(60000)
    // Should be around 70k–72k
    expect(result).toBeGreaterThan(68000)
  })

  test('zero tenure months returns 0', () => {
    const result = calcRDMaturity(5000, 7, 0)
    expect(result).toBe(0)
  })
})
