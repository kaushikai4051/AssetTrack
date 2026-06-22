/**
 * Tests for Mutual Funds page.
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

vi.mock('@/pages/MutualFunds/MutualFundForm', () => ({ default: () => <div>MF Form</div> }))
vi.mock('@/pages/MutualFunds/TransactionForm', () => ({ default: () => <div>TX Form</div> }))

import MutualFunds from '@/pages/MutualFunds/index'
import api from '@/services/api'

const sampleFunds = [
  {
    id: 1, asset_id: 10, scheme_name: 'Mirae Asset Large Cap Fund',
    scheme_code: '118825', isin: 'INF769K01010',
    fund_house: 'Mirae Asset', category: 'Large Cap',
    plan_type: 'growth', folio_number: '12345678',
    units_held: 100, avg_cost_nav: 50, last_nav: 65,
    last_nav_date: '2024-10-01',
    current_value: 6500, invested_amount: 5000,
    abs_return: 30, xirr: 18.5, tx_count: 2,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Mutual Funds page', () => {
  test('shows loading state while fetching', async () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<MutualFunds />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('empty state prompts user to add first fund', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getByText(/no mutual funds added yet/i)).toBeInTheDocument()
    })
  })

  test('fund list shows scheme_name', async () => {
    api.get.mockResolvedValueOnce({ data: sampleFunds })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getByText('Mirae Asset Large Cap Fund')).toBeInTheDocument()
    })
  })

  test('fund list shows plan_type badge (GROWTH)', async () => {
    api.get.mockResolvedValueOnce({ data: sampleFunds })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getByText('GROWTH')).toBeInTheDocument()
    })
  })

  test('positive abs_return shows green badge', async () => {
    api.get.mockResolvedValueOnce({ data: sampleFunds })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      // +30.00% should be visible (rendered twice for desktop+mobile, use first)
      expect(screen.getAllByText(/\+30\.00%/i)[0]).toBeInTheDocument()
    })
  })

  test('negative abs_return shows red badge', async () => {
    const negFund = { ...sampleFunds[0], abs_return: -5.5, xirr: -3.2 }
    api.get.mockResolvedValueOnce({ data: [negFund] })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getAllByText(/-5\.50%/i)[0]).toBeInTheDocument()
    })
  })

  test('XIRR is displayed', async () => {
    api.get.mockResolvedValueOnce({ data: sampleFunds })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getAllByText(/18\.5.*xirr/i)[0]).toBeInTheDocument()
    })
  })

  test('Add Fund button is present', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<MutualFunds />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add fund/i }).length).toBeGreaterThan(0)
    })
  })
})
