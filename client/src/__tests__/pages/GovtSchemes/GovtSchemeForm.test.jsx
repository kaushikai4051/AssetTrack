/**
 * Tests for GovtSchemeForm component.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../mocks/queryClient'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/ui/input', () => ({
  Input: ({ type, step, ...props }) => <input type="text" {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }) => <select {...props}>{children}</select>,
}))

import GovtSchemeForm from '@/pages/GovtSchemes/GovtSchemeForm'
import api from '@/services/api'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function renderForm(holding = null) {
  return renderWithProviders(<GovtSchemeForm onClose={onClose} holding={holding} />)
}
function getForm(container) {
  return container.querySelector('form')
}

describe('GovtSchemeForm', () => {
  test('renders scheme type dropdown with PPF as default', () => {
    renderForm()
    const schemeSelect = screen.getByLabelText(/scheme type/i)
    expect(schemeSelect).toBeInTheDocument()
    // Default should be PPF
    expect(schemeSelect.value).toBe('ppf')
  })

  test('PPF form shows account_number, institution, start_date, invested_amount', () => {
    renderForm()
    expect(screen.getByLabelText(/account.*number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bank.*post office/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start.*opening date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount invested/i)).toBeInTheDocument()
  })

  test('NPS mode shows PRAN field', () => {
    // Test initial NPS mode via edit holding — avoids jsdom watch() re-render timing issues
    renderForm({
      asset_id: 1, scheme_type: 'nps',
      account_number: null, institution: 'NPS Trust',
      start_date: null, maturity_date: null, interest_rate: null,
      invested_amount: 200000, current_value: 225000,
      pran: 'TEST1234567890', nps_account_type: 'tier1', fund_manager: 'HDFC Pension',
      uan: null, employee_share: null, employer_share: null, eps_balance: null,
      beneficiary_name: null, beneficiary_dob: null, maturity_period_months: null,
      nominee: null, notes: null,
    })
    expect(screen.getByLabelText(/pran/i)).toBeInTheDocument()
  })

  test('NPS form shows tier (I/II) dropdown and fund_manager', () => {
    renderForm({
      asset_id: 1, scheme_type: 'nps',
      account_number: null, institution: null, start_date: null, maturity_date: null,
      interest_rate: null, invested_amount: 0, current_value: 0,
      pran: null, nps_account_type: 'tier1', fund_manager: null,
      uan: null, employee_share: null, employer_share: null, eps_balance: null,
      beneficiary_name: null, beneficiary_dob: null, maturity_period_months: null,
      nominee: null, notes: null,
    })
    expect(screen.getByLabelText(/account type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/fund manager/i)).toBeInTheDocument()
    const tierSelect = screen.getByLabelText(/account type/i)
    const options = Array.from(tierSelect.querySelectorAll('option')).map((o) => o.value)
    expect(options).toContain('tier1')
    expect(options).toContain('tier2')
  })

  test('EPF mode shows UAN field', () => {
    renderForm({
      asset_id: 2, scheme_type: 'epf',
      account_number: null, institution: 'EPFO', start_date: null, maturity_date: null,
      interest_rate: 8.25, invested_amount: 240000, current_value: 270000,
      pran: null, nps_account_type: null, fund_manager: null,
      uan: '100234567890', employee_share: null, employer_share: null, eps_balance: null,
      beneficiary_name: null, beneficiary_dob: null, maturity_period_months: null,
      nominee: null, notes: null,
    })
    expect(screen.getByLabelText(/uan/i)).toBeInTheDocument()
  })

  test('submitting empty required fields shows validation error', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add scheme/i }))

    await waitFor(() => {
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument()
    })
  })

  test('valid PPF submission calls POST /assets/govt-schemes', async () => {
    api.post.mockResolvedValueOnce({ data: { asset_id: 200 } })

    const { container } = renderForm()

    fireEvent.change(screen.getByLabelText(/account.*number/i), {
      target: { value: 'PPF-001234567' },
    })
    fireEvent.change(screen.getByLabelText(/bank.*post office/i), {
      target: { value: 'State Bank of India' },
    })
    fireEvent.change(screen.getByLabelText(/amount invested/i), { target: { value: '150000' } })

    await act(async () => {
      fireEvent.submit(getForm(container))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/assets/govt-schemes',
        expect.objectContaining({ scheme_type: 'ppf' })
      )
    })
  })

  test('edit mode: scheme type is locked (disabled)', () => {
    const holding = {
      asset_id: 200, scheme_type: 'ppf',
      account_number: 'PPF-001', institution: 'SBI',
      start_date: '2020-04-01', maturity_date: null,
      interest_rate: 7.1, invested_amount: 150000, current_value: 180000,
      pran: null, uan: null, nps_account_type: null, fund_manager: null,
      employee_share: null, employer_share: null, eps_balance: null,
      beneficiary_name: null, beneficiary_dob: null, maturity_period_months: null,
      nominee: null, notes: null,
    }
    renderForm(holding)

    const schemeSelect = screen.getByLabelText(/scheme type/i)
    expect(schemeSelect).toBeDisabled()
  })
})
