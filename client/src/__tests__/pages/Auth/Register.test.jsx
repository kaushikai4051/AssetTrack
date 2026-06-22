/**
 * Tests for Register page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({ post: vi.fn(), get: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } })),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/store/authStore', () => ({
  default: vi.fn((selector) => selector({
    login: vi.fn(),
    logout: vi.fn(),
    accessToken: null,
    user: null,
    isLoggedIn: false,
  })),
}))

import Register from '@/pages/Auth/Register'
import axios from 'axios'

function renderRegister() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockClear()
})

describe('Register page', () => {
  test('renders name, email, password, confirm-password fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  test('password mismatch shows "Passwords do not match" error', async () => {
    renderRegister()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/full name/i), 'Priya Singh')
    await user.type(screen.getByLabelText(/email/i), 'priya@example.com')

    const pwdField = screen.getByPlaceholderText(/min 8 characters/i)
    const confirmField = screen.getByPlaceholderText(/re-enter/i)

    await user.type(pwdField, 'StrongPass1')
    await user.type(confirmField, 'DifferentPass1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  test('password shorter than 8 chars shows minLength error', async () => {
    renderRegister()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/full name/i), 'Amit Kumar')
    await user.type(screen.getByLabelText(/email/i), 'amit@example.com')
    await user.type(screen.getByPlaceholderText(/min 8 characters/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/min 8 characters/i)).toBeInTheDocument()
    })
  })

  test('successful registration navigates to /dashboard', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        user: { id: 5, email: 'priya@example.com', full_name: 'Priya Singh' },
        accessToken: 'new-access-token',
      },
    })

    renderRegister()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/full name/i), 'Priya Singh')
    await user.type(screen.getByLabelText(/email/i), 'priya@example.com')
    await user.type(screen.getByPlaceholderText(/min 8 characters/i), 'StrongPass1')
    await user.type(screen.getByPlaceholderText(/re-enter/i), 'StrongPass1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('duplicate email (409 response) shows "Email already registered" error', async () => {
    const error = {
      response: {
        status: 409,
        data: { message: 'Email already registered' },
      },
    }
    axios.post.mockRejectedValueOnce(error)

    renderRegister()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/full name/i), 'Existing User')
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com')
    await user.type(screen.getByPlaceholderText(/min 8 characters/i), 'SomePass123')
    await user.type(screen.getByPlaceholderText(/re-enter/i), 'SomePass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    })
  })

  test('shows link to login page', () => {
    renderRegister()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })
})
