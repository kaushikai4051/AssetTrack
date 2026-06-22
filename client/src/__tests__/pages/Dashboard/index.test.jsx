/**
 * Tests for Dashboard page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../mocks/queryClient'

// Mock the api service
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

// Mock PageWrapper to avoid layout dependencies
vi.mock('@/components/layout/PageWrapper', () => ({
  default: ({ children, title }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import Dashboard from '@/pages/Dashboard/index'
import api from '@/services/api'

const summaryData = {
  netWorth: 1500000,
  totalAssets: 1500000,
  totalLiabilities: 0,
  totalInvested: 1200000,
  totalGain: 300000,
  overallReturn: 25,
  assetCount: 8,
  upcomingEvents: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Dashboard page', () => {
  test('shows 4 skeleton cards while loading', async () => {
    // Delay the API response so we catch the loading state
    api.get.mockImplementation(() => new Promise(() => {}))

    const { container } = renderWithProviders(<Dashboard />)

    // During loading, we expect 4 skeleton card placeholders
    await waitFor(() => {
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThanOrEqual(4)
    })
  })

  test('on error shows "Could not load dashboard data" message', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'))

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/could not load dashboard data/i)).toBeInTheDocument()
    })
  })

  test('on success renders Net Worth, Total Invested, Total Gain/Loss, Active Assets', async () => {
    api.get.mockResolvedValueOnce({ data: summaryData })

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Net Worth')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Invested')).toBeInTheDocument()
    expect(screen.getByText('Total Gain / Loss')).toBeInTheDocument()
    expect(screen.getByText('Active Assets')).toBeInTheDocument()
  })

  test('Net Worth value is formatted in INR compact form', async () => {
    api.get.mockResolvedValueOnce({ data: summaryData })

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      // 1500000 should show as ₹15.00L or similar compact format
      const text = screen.getAllByText(/₹.*L|₹.*lakh/i)[0]
      expect(text).toBeInTheDocument()
    })
  })

  test('no upcoming events shows placeholder text', async () => {
    api.get.mockResolvedValueOnce({ data: { ...summaryData, upcomingEvents: [] } })

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument()
    })
  })

  test('upcoming events list renders when data has events', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ...summaryData,
        upcomingEvents: [
          { label: 'FD Maturity: FD — SBI', date: '2025-03-15' },
          { label: 'FD Maturity: FD — HDFC', date: '2025-04-01' },
        ],
      },
    })

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('FD Maturity: FD — SBI')).toBeInTheDocument()
    })
    expect(screen.getByText('FD Maturity: FD — HDFC')).toBeInTheDocument()
  })

  test('asset count is displayed', async () => {
    api.get.mockResolvedValueOnce({ data: summaryData })

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument()
    })
  })
})
