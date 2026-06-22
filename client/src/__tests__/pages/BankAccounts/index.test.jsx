/**
 * Tests for Bank Accounts page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  default: ({ children, title, description }) => (
    <div><h1>{title}</h1><p>{description}</p>{children}</div>
  ),
}))

vi.mock('@/components/shared/Modal', () => ({
  default: ({ children, title, onClose }) => (
    <div role="dialog" aria-label={title}>
      <button onClick={onClose}>Close</button>
      {children}
    </div>
  ),
}))

// Shallow mock forms to avoid deep dependency chain
vi.mock('@/pages/BankAccounts/FDForm', () => ({ default: () => <div>FD Form</div> }))
vi.mock('@/pages/BankAccounts/RDForm', () => ({ default: () => <div>RD Form</div> }))
vi.mock('@/pages/BankAccounts/SavingsForm', () => ({ default: () => <div>Savings Form</div> }))

import BankAccounts from '@/pages/BankAccounts/index'
import api from '@/services/api'

const sampleFDs = [
  {
    id: 1, bank_name: 'State Bank of India', account_number: '123456789',
    principal: 100000, interest_rate: 7, compounding: 'quarterly',
    maturity_amount: 107000, maturity_date: '2026-01-01', is_auto_renew: false,
    nominee_name: 'Priya Sharma', notes: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Bank Accounts page', () => {
  test('renders tabs for Fixed Deposits, Recurring Deposits, Savings Accounts', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(<BankAccounts />)

    expect(screen.getByText('Fixed Deposits')).toBeInTheDocument()
    expect(screen.getByText('Recurring Deposits')).toBeInTheDocument()
    expect(screen.getByText('Savings Accounts')).toBeInTheDocument()
  })

  test('empty FD list shows empty state message', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(<BankAccounts />)

    await waitFor(() => {
      expect(screen.getByText(/no fixed deposits added yet/i)).toBeInTheDocument()
    })
  })

  test('FD list shows bank name, principal, maturity amount for each entry', async () => {
    api.get.mockResolvedValue({ data: sampleFDs })
    renderWithProviders(<BankAccounts />)

    await waitFor(() => {
      expect(screen.getByText('State Bank of India')).toBeInTheDocument()
    })
    // Principal and maturity amounts should be rendered via formatINR
    expect(screen.getByText(/1,00,000|100,000/)).toBeInTheDocument()
    expect(screen.getByText(/1,07,000|107,000/)).toBeInTheDocument()
  })

  test('clicking "Add FD" button opens the FD form modal', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(<BankAccounts />)

    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText(/add fixed deposit/i)).toBeInTheDocument()
    })

    const addBtn = screen.getByRole('button', { name: /add fixed deposit/i })
    await user.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('FD Form')).toBeInTheDocument()
    })
  })
})
