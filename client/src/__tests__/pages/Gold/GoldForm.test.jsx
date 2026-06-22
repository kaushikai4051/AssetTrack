/**
 * Tests for GoldForm component.
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
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }) => <select {...props}>{children}</select>,
}))

import GoldForm from '@/pages/Gold/GoldForm'
import api from '@/services/api'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function renderGoldForm() {
  return renderWithProviders(<GoldForm onClose={onClose} />)
}

describe('GoldForm', () => {
  test('renders gold type radio buttons', () => {
    renderGoldForm()

    // Radio buttons via label text
    expect(screen.getByText('Physical Gold')).toBeInTheDocument()
    expect(screen.getByText('Digital Gold')).toBeInTheDocument()
    expect(screen.getByText('Gold ETF')).toBeInTheDocument()
    expect(screen.getByText(/sovereign gold bond/i)).toBeInTheDocument()
  })

  test('physical gold shows purity and storage location fields', async () => {
    renderGoldForm()
    // Default is physical
    expect(screen.getByLabelText(/purity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/storage location/i)).toBeInTheDocument()
  })

  test('selecting SGB shows issue_date, maturity_date, coupon_rate fields', async () => {
    renderGoldForm()
    const user = userEvent.setup()

    const sgbRadio = screen.getByDisplayValue('sgb')
    await user.click(sgbRadio)

    await waitFor(() => {
      expect(screen.getByLabelText(/issue date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/coupon rate/i)).toBeInTheDocument()
    })
  })

  test('selecting ETF shows ticker and broker fields', async () => {
    renderGoldForm()
    const user = userEvent.setup()

    const etfRadio = screen.getByDisplayValue('etf')
    await user.click(etfRadio)

    await waitFor(() => {
      expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/broker/i)).toBeInTheDocument()
    })
  })

  test('selecting digital gold shows platform dropdown', async () => {
    renderGoldForm()
    const user = userEvent.setup()

    const digitalRadio = screen.getByDisplayValue('digital')
    await user.click(digitalRadio)

    await waitFor(() => {
      expect(screen.getByLabelText(/platform/i)).toBeInTheDocument()
    })
  })

  test('all types show quantity/weight and purchase price fields', () => {
    renderGoldForm()

    // Weight in grams for physical (default)
    expect(screen.getByText(/weight \(grams\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/purchase price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/purchase date/i)).toBeInTheDocument()
  })

  test('submit with empty required fields shows name required error', async () => {
    renderGoldForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add gold holding/i }))

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })
})
