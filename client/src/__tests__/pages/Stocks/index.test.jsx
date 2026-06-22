/**
 * Tests for Stocks page.
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

vi.mock('@/pages/Stocks/StockForm', () => ({ default: () => <div>Stock Form</div> }))
vi.mock('@/pages/Stocks/StockTransactionForm', () => ({ default: () => <div>Stock TX Form</div> }))

import Stocks from '@/pages/Stocks/index'
import api from '@/services/api'

const sampleStocks = [
  {
    id: 10, asset_id: 50, ticker: 'RELIANCE',
    company_name: 'Reliance Industries Ltd',
    exchange: 'NSE', sector: 'Energy',
    isin: 'INE002A01018', broker: 'Zerodha',
    shares_held: 10, avg_cost_price: 2500,
    last_price: 2800, last_price_date: '2024-10-01',
    current_value: 28000, invested_amount: 25000,
    pnl: 3000, pnl_pct: 12,
    ltcg_shares: 5, stcg_shares: 5, ltcg_gain: 1500, stcg_gain: 1500,
    tx_count: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Stocks page', () => {
  test('shows loading while fetching', async () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<Stocks />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('empty state prompts to add stock', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getByText(/no stocks added yet/i)).toBeInTheDocument()
    })
  })

  test('shows company_name and ticker for each holding', async () => {
    api.get.mockResolvedValueOnce({ data: sampleStocks })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument()
    })
    expect(screen.getByText('RELIANCE')).toBeInTheDocument()
  })

  test('shows exchange badge', async () => {
    api.get.mockResolvedValueOnce({ data: sampleStocks })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getByText('NSE')).toBeInTheDocument()
    })
  })

  test('shows P&L badge', async () => {
    api.get.mockResolvedValueOnce({ data: sampleStocks })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getAllByText(/\+12\.00%/)[0]).toBeInTheDocument()
    })
  })

  test('sector label visible when sector is set', async () => {
    api.get.mockResolvedValueOnce({ data: sampleStocks })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getByText('Energy')).toBeInTheDocument()
    })
  })

  test('Add Stock button is present', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<Stocks />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add stock/i }).length).toBeGreaterThan(0)
    })
  })
})
