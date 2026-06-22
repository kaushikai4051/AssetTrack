/**
 * Tests for client/src/utils/finance.js
 * Tests absoluteReturn, emi, fdMaturity, isPositive.
 */
import { describe, test, expect } from 'vitest'
import { absoluteReturn, emi, fdMaturity, isPositive } from '@/utils/finance'

describe('absoluteReturn', () => {
  test('calculates percentage gain correctly', () => {
    // (110000 - 100000) / 100000 * 100 = 10%
    expect(absoluteReturn(110000, 100000)).toBeCloseTo(10, 2)
  })

  test('calculates percentage loss correctly', () => {
    // (90000 - 100000) / 100000 * 100 = -10%
    expect(absoluteReturn(90000, 100000)).toBeCloseTo(-10, 2)
  })

  test('zero invested amount returns 0', () => {
    expect(absoluteReturn(50000, 0)).toBe(0)
    expect(absoluteReturn(50000, null)).toBe(0)
  })

  test('equal values returns 0%', () => {
    expect(absoluteReturn(100000, 100000)).toBe(0)
  })

  test('typical MF return: 5000 invested, current 5500', () => {
    expect(absoluteReturn(5500, 5000)).toBeCloseTo(10, 2)
  })

  test('large returns: 100000 invested, current 250000', () => {
    expect(absoluteReturn(250000, 100000)).toBeCloseTo(150, 2)
  })
})

describe('emi', () => {
  test('calculates home loan EMI correctly', () => {
    // Principal: 5000000 (50L), Rate: 8.5% p.a., Tenure: 240 months (20 years)
    // Expected EMI ≈ 43,391
    const result = emi(5000000, 8.5, 240)
    expect(result).toBeGreaterThan(40000)
    expect(result).toBeLessThan(50000)
  })

  test('zero interest rate returns principal / tenure', () => {
    const result = emi(120000, 0, 12)
    expect(result).toBeCloseTo(10000, 0)
  })

  test('short tenure car loan', () => {
    // 500000 car loan at 9% for 5 years (60 months)
    const result = emi(500000, 9, 60)
    expect(result).toBeGreaterThan(9000)
    expect(result).toBeLessThan(12000)
  })

  test('personal loan: 100000 at 12% for 24 months', () => {
    // Expected ≈ 4707
    const result = emi(100000, 12, 24)
    expect(result).toBeGreaterThan(4000)
    expect(result).toBeLessThan(5500)
  })
})

describe('fdMaturity', () => {
  test('cumulative FD: returns greater than principal', () => {
    const result = fdMaturity(100000, 7, 12, 'cumulative')
    expect(result).toBeGreaterThan(100000)
  })

  test('cumulative FD uses quarterly compounding', () => {
    // 100000 at 8% for 12 months quarterly = 100000*(1+0.08/4)^4 ≈ 108243
    const result = fdMaturity(100000, 8, 12, 'cumulative')
    expect(result).toBeCloseTo(108243, -1)
  })

  test('payout FD returns original principal', () => {
    const result = fdMaturity(100000, 7, 12, 'payout')
    expect(result).toBe(100000)
  })

  test('longer tenure gives higher maturity', () => {
    const result1yr = fdMaturity(100000, 7, 12, 'cumulative')
    const result3yr = fdMaturity(100000, 7, 36, 'cumulative')
    expect(result3yr).toBeGreaterThan(result1yr)
  })
})

describe('isPositive', () => {
  test('returns true for positive number', () => {
    expect(isPositive(100)).toBe(true)
    expect(isPositive(0.01)).toBe(true)
  })

  test('returns true for zero', () => {
    expect(isPositive(0)).toBe(true)
  })

  test('returns false for negative number', () => {
    expect(isPositive(-1)).toBe(false)
    expect(isPositive(-0.01)).toBe(false)
  })
})
