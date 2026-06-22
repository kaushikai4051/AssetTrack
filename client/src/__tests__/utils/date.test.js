/**
 * Tests for client/src/utils/date.js
 */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { formatDate, formatDateShort, daysUntil, currentFY, fyStart, fyEnd } from '@/utils/date'

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDate', () => {
  test('formats date string in DD MMM YYYY format', () => {
    const result = formatDate('2025-04-01')
    expect(result).toMatch(/\d{2}\s[A-Z][a-z]{2}\s\d{4}/)
    expect(result).toContain('2025')
    expect(result).toContain('Apr')
    expect(result).toContain('01')
  })

  test('returns em dash for null/undefined', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  test('accepts Date object', () => {
    const result = formatDate(new Date('2024-12-31'))
    expect(result).toContain('2024')
    expect(result).toContain('Dec')
    expect(result).toContain('31')
  })
})

describe('formatDateShort', () => {
  test('formats as DD/MM/YY', () => {
    const result = formatDateShort('2025-04-01')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/)
  })
})

describe('daysUntil', () => {
  test('returns positive number for future date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))

    const result = daysUntil('2025-01-10')
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(10)
  })

  test('returns negative number for past date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15'))

    const result = daysUntil('2025-01-10')
    expect(result).toBeLessThan(0)
  })

  test('returns 0 or small number for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-10'))

    const result = daysUntil('2025-01-10')
    // differenceInDays returns 0 for same day
    expect(result).toBe(0)
  })

  test('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull()
  })
})

describe('currentFY', () => {
  test('returns "2025-26" when month is April 2025', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-04-01'))
    expect(currentFY()).toBe('2025-26')
  })

  test('returns "2024-25" when month is March 2025', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-03-31'))
    expect(currentFY()).toBe('2024-25')
  })

  test('returns "2025-26" for September 2025', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-15'))
    expect(currentFY()).toBe('2025-26')
  })

  test('FY starts in April (month index 3)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-04-01'))
    expect(currentFY()).toBe('2025-26')
  })
})

describe('fyStart', () => {
  test('returns April 1 of the given year', () => {
    const result = fyStart('2025-26')
    expect(result.getMonth()).toBe(3)   // April = 3
    expect(result.getDate()).toBe(1)
    expect(result.getFullYear()).toBe(2025)
  })
})

describe('fyEnd', () => {
  test('returns March 31 of the following year', () => {
    const result = fyEnd('2025-26')
    expect(result.getMonth()).toBe(2)   // March = 2
    expect(result.getDate()).toBe(31)
    expect(result.getFullYear()).toBe(2026)
  })
})
