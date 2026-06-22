/**
 * Tests for MutualFundForm component.
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

import MutualFundForm from '@/pages/MutualFunds/MutualFundForm'
import api from '@/services/api'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MutualFundForm', () => {
  // The form starts in 'search' mode. Must click 'Manual Entry' to access manual fields.
  // Labels lack htmlFor/id associations, so queries use placeholder text or text content.

  test('renders fund name, scheme code, fund house, category fields in manual entry mode', async () => {
    renderWithProviders(<MutualFundForm onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /manual entry/i }))

    // fundDetailsReady=true immediately in manual mode, so common fields also visible
    expect(screen.getByPlaceholderText(/hdfc mid-cap/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/118989/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/hdfc mutual fund/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/equity.*mid cap/i)).toBeInTheDocument()
    expect(screen.getByText(/plan type/i)).toBeInTheDocument()
    expect(screen.getByText(/folio/i)).toBeInTheDocument()
  })

  test('renders first transaction section fields in manual entry mode', async () => {
    renderWithProviders(<MutualFundForm onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /manual entry/i }))

    expect(screen.getByText(/date \*/i)).toBeInTheDocument()
    expect(screen.getByText(/units.*auto/i)).toBeInTheDocument()
    expect(screen.getByText(/nav.*₹/i)).toBeInTheDocument()
    expect(screen.getByText(/amount.*₹/i)).toBeInTheDocument()
  })

  test('submitting with empty form shows required errors', async () => {
    const { container } = renderWithProviders(<MutualFundForm onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /manual entry/i }))
    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      const errors = screen.getAllByText(/required/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  test('valid submission calls POST /assets/mutual-funds', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 10, fund_id: 5 } })

    const { container } = renderWithProviders(<MutualFundForm onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /manual entry/i }))

    fireEvent.change(screen.getByPlaceholderText(/hdfc mid-cap/i), {
      target: { value: 'Axis Bluechip Fund' },
    })
    fireEvent.change(screen.getByPlaceholderText(/hdfc mutual fund/i), {
      target: { value: 'Axis Mutual Fund' },
    })
    fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '50' } })
    fireEvent.change(screen.getByPlaceholderText(/5000/i), { target: { value: '9700' } })

    await act(async () => {
      fireEvent.submit(container.querySelector('form'))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/assets/mutual-funds',
        expect.objectContaining({ scheme_name: 'Axis Bluechip Fund' })
      )
    })
  })
})
