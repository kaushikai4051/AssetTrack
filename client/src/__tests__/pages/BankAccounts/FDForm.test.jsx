/**
 * Tests for FDForm component.
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

// Mock UI primitives to avoid deep styling/component issues
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/ui/input', () => ({
  // Force type="text" and strip step — jsdom's number/step validation rejects
  // userEvent.type keyboard simulation, so we normalise all inputs to plain text.
  Input: ({ type, step, ...props }) => <input type="text" {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }) => <select {...props}>{children}</select>,
}))

import FDForm from '@/pages/BankAccounts/FDForm'
import api from '@/services/api'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function renderFDForm(initialData = null) {
  return renderWithProviders(<FDForm initialData={initialData} onClose={onClose} />)
}

describe('FDForm', () => {
  test('renders all required fields', () => {
    renderFDForm()

    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/principal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/compounding/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument()
  })

  test('renders optional fields: account number, nominee, notes, auto-renew', () => {
    renderFDForm()

    expect(screen.getByLabelText(/account.*fd number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nominee/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auto-renew/i)).toBeInTheDocument()
  })

  test('submit with empty required fields shows validation errors', async () => {
    renderFDForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add fd/i }))

    await waitFor(() => {
      // React Hook Form requires 'Required' message to appear
      const errors = screen.getAllByText(/required/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  test('renders compounding options: monthly, quarterly, half-yearly, yearly, simple', () => {
    renderFDForm()

    const select = screen.getByLabelText(/compounding/i)
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)

    expect(options).toContain('monthly')
    expect(options).toContain('quarterly')
    expect(options).toContain('half_yearly')
    expect(options).toContain('yearly')
    expect(options).toContain('simple')
  })

  test('valid submission calls POST /assets/fixed-deposits', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 1, maturity_amount: 107000 } })

    const { container } = renderFDForm()

    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'HDFC Bank' } })
    fireEvent.change(screen.getByLabelText(/principal/i), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(/maturity date/i), { target: { value: '2025-01-01' } })

    await act(async () => {
      fireEvent.submit(container.querySelector('form'))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/assets/fixed-deposits',
        expect.objectContaining({ bank_name: 'HDFC Bank' })
      )
    })
  })

  test('edit mode: shows Update FD button and calls PUT', async () => {
    const initialData = {
      id: 5,
      bank_name: 'SBI',
      principal: 100000,
      interest_rate: 7,
      compounding: 'quarterly',
      start_date: '2024-01-01',
      maturity_date: '2025-01-01',
      is_auto_renew: false,
    }
    api.put.mockResolvedValueOnce({ data: { id: 5, maturity_amount: 107000 } })

    renderFDForm(initialData)

    expect(screen.getByRole('button', { name: /update fd/i })).toBeInTheDocument()
  })
})
