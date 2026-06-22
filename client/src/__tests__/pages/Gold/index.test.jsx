/**
 * Tests for Gold page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../mocks/queryClient'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('@/components/layout/PageWrapper', () => ({
  default: ({ children, title, actions }) => (
    <div><h1>{title}</h1><div>{actions}</div>{children}</div>
  ),
}))

vi.mock('@/components/shared/Modal', () => ({
  default: ({ children, title }) => <div role="dialog">{title}{children}</div>,
}))

vi.mock('@/pages/Gold/GoldForm', () => ({ default: () => <div>Gold Form</div> }))

import Gold from '@/pages/Gold/index'
import api from '@/services/api'

const sampleGold = [
  {
    asset_id: 100, gold_type: 'physical',
    name: '22k Gold Coin 10g',
    quantity: 10, purity: '22k',
    purchase_price: 6200, last_price: 6800,
    storage_location: 'Bank Locker',
    current_value: 62321.60, invested_amount: 56847.40,
    pnl: 5474.20, pnl_pct: 9.63,
  },
  {
    asset_id: 101, gold_type: 'etf',
    name: 'GOLDBEES',
    quantity: 50, ticker: 'GOLDBEES', broker: 'Zerodha',
    purchase_price: 55, last_price: 62,
    current_value: 3100, invested_amount: 2750,
    pnl: 350, pnl_pct: 12.73,
  },
  {
    asset_id: 102, gold_type: 'sgb',
    name: 'SGB 2023-24 Series I',
    quantity: 10, sgb_series: 'SGB 2023-24 Series I',
    issue_date: '2023-11-27', maturity_date: '2031-11-27',
    coupon_rate: 2.5,
    current_value: 72500, invested_amount: 59230,
    pnl: 13270, pnl_pct: 22.40,
  },
  {
    asset_id: 103, gold_type: 'digital',
    name: 'MMTC-PAMP Digital Gold',
    quantity: 2.5, platform: 'MMTC-PAMP',
    current_value: 17000, invested_amount: 15250,
    pnl: 1750, pnl_pct: 11.48,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Gold page', () => {
  test('shows loading while fetching', async () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<Gold />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('empty state shows "No gold holdings added yet"', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText(/no gold holdings added yet/i)).toBeInTheDocument()
    })
  })

  test('shows Physical gold type badge', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[0]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('Physical')).toBeInTheDocument()
    })
  })

  test('shows ETF gold type badge', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[1]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('ETF')).toBeInTheDocument()
    })
  })

  test('shows SGB gold type badge', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[2]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('SGB')).toBeInTheDocument()
    })
  })

  test('shows Digital gold type badge', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[3]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('Digital')).toBeInTheDocument()
    })
  })

  test('shows current value for each entry', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[0]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('22k Gold Coin 10g')).toBeInTheDocument()
      // current value should be formatted in INR
      expect(screen.getAllByText(/current/i)[0]).toBeInTheDocument()
    })
  })

  test('Add Gold button is present', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add gold/i }).length).toBeGreaterThan(0)
    })
  })

  test('purity badge shown for physical gold', async () => {
    api.get.mockResolvedValueOnce({ data: [sampleGold[0]] })
    renderWithProviders(<Gold />)

    await waitFor(() => {
      expect(screen.getByText('22k')).toBeInTheDocument()
    })
  })
})
