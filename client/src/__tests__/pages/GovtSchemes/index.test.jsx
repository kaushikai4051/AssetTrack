/**
 * Tests for Government Schemes page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../mocks/queryClient'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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

vi.mock('@/pages/GovtSchemes/GovtSchemeForm', () => ({ default: () => <div>Scheme Form</div> }))
vi.mock('@/pages/GovtSchemes/GovtSchemeTransactionForm', () => ({ default: () => <div>TX Form</div> }))

import GovtSchemes from '@/pages/GovtSchemes/index'
import api from '@/services/api'

const sampleSchemes = [
  {
    asset_id: 200, scheme_type: 'ppf',
    asset_name: 'PPF 001234567', account_number: 'PPF-001234567',
    institution: 'SBI', interest_rate: 7.1,
    current_value: 180000, invested_amount: 150000,
    pnl: 30000, pnl_pct: 20,
    maturity_date: '2035-04-01', maturity_amount: null,
    pran: null, uan: null, nps_account_type: null, fund_manager: null,
    employee_share: null, employer_share: null, eps_balance: null,
    beneficiary_name: null, beneficiary_dob: null,
  },
  {
    asset_id: 201, scheme_type: 'nps',
    asset_name: 'NPS PRAN1234567890', account_number: null,
    institution: 'NPS Trust', interest_rate: null,
    current_value: 225000, invested_amount: 200000,
    pnl: 25000, pnl_pct: 12.5,
    maturity_date: null, maturity_amount: null,
    pran: 'PRAN1234567890', uan: null, nps_account_type: 'tier1', fund_manager: 'HDFC Pension',
    employee_share: null, employer_share: null, eps_balance: null,
    beneficiary_name: null, beneficiary_dob: null,
  },
  {
    asset_id: 202, scheme_type: 'epf',
    asset_name: 'EPF 100234567890', account_number: null,
    institution: 'EPFO', interest_rate: 8.25,
    current_value: 270000, invested_amount: 240000,
    pnl: 30000, pnl_pct: 12.5,
    maturity_date: null, maturity_amount: null,
    pran: null, uan: '100234567890', nps_account_type: null, fund_manager: null,
    employee_share: 120000, employer_share: 120000, eps_balance: 50000,
    beneficiary_name: null, beneficiary_dob: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Government Schemes page', () => {
  test('shows loading while fetching', async () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<GovtSchemes />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('renders PPF, NPS, EPF tabs (always visible)', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getByText('PPF')).toBeInTheDocument()
    })
    expect(screen.getByText('NPS')).toBeInTheDocument()
    expect(screen.getByText('EPF')).toBeInTheDocument()
  })

  test('PPF tab shows PPF account details', async () => {
    api.get.mockResolvedValueOnce({ data: sampleSchemes })
    renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getByText('PPF 001234567')).toBeInTheDocument()
    })
    // Interest rate badge
    expect(screen.getByText(/7\.10% p\.a\./)).toBeInTheDocument()
  })

  test('NPS tab shows PRAN and fund manager when switched', async () => {
    api.get.mockResolvedValueOnce({ data: sampleSchemes })
    const { getByRole } = renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getByText('PPF')).toBeInTheDocument()
    })

    // Click NPS tab
    const npsTab = getByRole('button', { name: /nps/i })
    npsTab.click()

    await waitFor(() => {
      expect(screen.getAllByText(/PRAN1234567890/)[0]).toBeInTheDocument()
    })
  })

  test('EPF tab shows UAN when switched', async () => {
    api.get.mockResolvedValueOnce({ data: sampleSchemes })
    const { getByRole } = renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getByText('EPF')).toBeInTheDocument()
    })

    // Click EPF tab
    const epfTab = getByRole('button', { name: /epf/i })
    epfTab.click()

    await waitFor(() => {
      expect(screen.getAllByText(/100234567890/)[0]).toBeInTheDocument()
    })
  })

  test('Add Scheme button is present', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add scheme/i }).length).toBeGreaterThan(0)
    })
  })

  test('empty PPF tab shows empty state message', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderWithProviders(<GovtSchemes />)

    await waitFor(() => {
      expect(screen.getByText(/no ppf holdings added yet/i)).toBeInTheDocument()
    })
  })
})
