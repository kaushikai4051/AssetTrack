/**
 * Tests for StockForm component.
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

import StockForm from '@/pages/Stocks/StockForm'
import api from '@/services/api'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StockForm', () => {
  test('renders required fields: ticker, exchange, shares, buy_price, buy_date', () => {
    renderWithProviders(<StockForm onClose={onClose} />)

    expect(screen.getByPlaceholderText('e.g. RELIANCE')).toBeInTheDocument()         // ticker (exact match)
    expect(screen.getByPlaceholderText(/reliance industries/i)).toBeInTheDocument() // company name
    expect(screen.getByText(/exchange/i)).toBeInTheDocument()
    expect(screen.getByText(/buy date/i)).toBeInTheDocument()
    expect(screen.getByText(/shares/i)).toBeInTheDocument()
    expect(screen.getByText(/buy price/i)).toBeTruthy()
  })

  test('renders optional fields: brokerage, notes (broker, ISIN)', () => {
    renderWithProviders(<StockForm onClose={onClose} />)

    expect(screen.getByPlaceholderText(/zerodha/i)).toBeInTheDocument()     // broker
    expect(screen.getByPlaceholderText(/INE/i)).toBeInTheDocument()         // isin
    expect(screen.getByText(/brokerage.*stt/i)).toBeTruthy()                // brokerage label
  })

  test('exchange dropdown has NSE and BSE options', () => {
    renderWithProviders(<StockForm onClose={onClose} />)

    const select = screen.getByDisplayValue('NSE')  // default value
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)

    expect(options).toContain('NSE')
    expect(options).toContain('BSE')
  })

  test('submit with empty form shows required errors', async () => {
    renderWithProviders(<StockForm onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add stock/i }))

    await waitFor(() => {
      const errors = screen.getAllByText(/required/i)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  test('valid submission calls POST /assets/stocks', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 50, holding_id: 10 } })

    const { container } = renderWithProviders(<StockForm onClose={onClose} />)

    // fireEvent.change sets el.value via RTL's setNativeValue and fires the change
    // event — React's ChangeEventPlugin calls onChange for both input and change events.
    fireEvent.change(screen.getByPlaceholderText(/reliance industries/i), {
      target: { value: 'Tata Consultancy Services' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE'), {
      target: { value: 'TCS' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '3500' } })
    fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '5' } })

    await act(async () => {
      fireEvent.submit(container.querySelector('form'))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/assets/stocks',
        expect.objectContaining({ company_name: 'Tata Consultancy Services' })
      )
    })
  })
})
