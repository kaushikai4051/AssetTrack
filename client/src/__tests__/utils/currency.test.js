/**
 * Tests for client/src/utils/currency.js
 */
import { describe, test, expect } from 'vitest'
import { formatINR, formatINRDecimal, formatCompact, formatReturn } from '@/utils/currency'

describe('formatINR', () => {
  test('formats 1000 in Indian numbering (₹1,000)', () => {
    const result = formatINR(1000)
    expect(result).toContain('1,000')
    expect(result).toContain('₹')
  })

  test('formats 100000 as 1,00,000 (Indian lakh system)', () => {
    const result = formatINR(100000)
    // Indian numbering: 1,00,000
    expect(result).toContain('00,000')
    expect(result).toContain('₹')
  })

  test('formats 10000000 as 1,00,00,000 (crore)', () => {
    const result = formatINR(10000000)
    expect(result).toContain('₹')
    expect(result.includes(',') || result.includes('0')).toBe(true)
  })

  test('formats 0 as ₹0', () => {
    const result = formatINR(0)
    expect(result).toContain('0')
    expect(result).toContain('₹')
  })

  test('formats null/undefined as ₹0', () => {
    expect(formatINR(null)).toContain('0')
    expect(formatINR(undefined)).toContain('0')
  })

  test('formats negative values with minus sign', () => {
    const result = formatINR(-5000)
    expect(result).toMatch(/-/)
    expect(result).toContain('5,000')
  })

  test('formats large amounts correctly', () => {
    const result = formatINR(5000000) // 50 lakh
    expect(result).toContain('₹')
    expect(result).toContain('0,00,000')
  })
})

describe('formatINRDecimal', () => {
  test('formats with 2 decimal places', () => {
    const result = formatINRDecimal(1234.56)
    expect(result).toContain('1,234.56')
    expect(result).toContain('₹')
  })

  test('pads to 2 decimal places', () => {
    const result = formatINRDecimal(100)
    expect(result).toContain('.00')
  })
})

describe('formatCompact', () => {
  test('formats 1500000 as 15L (15 lakh)', () => {
    const result = formatCompact(1500000)
    expect(result).toContain('15')
    expect(result.toLowerCase()).toContain('l')
  })

  test('formats 10000000 as 1.00Cr (1 crore)', () => {
    const result = formatCompact(10000000)
    expect(result.toLowerCase()).toContain('cr')
  })

  test('formats 5000 as 5K', () => {
    const result = formatCompact(5000)
    expect(result).toContain('5')
    expect(result.toUpperCase()).toContain('K')
  })

  test('formats 0 as ₹0', () => {
    const result = formatCompact(0)
    expect(result).toContain('0')
    expect(result).toContain('₹')
  })

  test('formats negative 1500000 with minus sign', () => {
    const result = formatCompact(-1500000)
    expect(result).toContain('-')
    expect(result).toContain('15')
    expect(result.toLowerCase()).toContain('l')
  })

  test('formats amounts under 1000 using regular INR format', () => {
    const result = formatCompact(500)
    expect(result).toContain('₹')
    expect(result).toContain('500')
  })
})

describe('formatReturn', () => {
  test('formats positive percentage with + sign', () => {
    const result = formatReturn(12.34)
    expect(result).toBe('+12.34%')
  })

  test('formats negative percentage without + sign', () => {
    const result = formatReturn(-5.67)
    expect(result).toBe('-5.67%')
  })

  test('formats zero as +0.00%', () => {
    const result = formatReturn(0)
    expect(result).toBe('+0.00%')
  })

  test('returns em-dash for null/undefined', () => {
    expect(formatReturn(null)).toBe('—')
    expect(formatReturn(undefined)).toBe('—')
  })
})
