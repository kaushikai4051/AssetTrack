/**
 * Tests for Login page.
 */
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// Mock axios (used directly in Login, not via api service)
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({ post: vi.fn(), get: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } })),
  },
}))

// Mock react-router-dom's navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock auth store
vi.mock('@/store/authStore', () => ({
  default: vi.fn((selector) => selector({
    login: vi.fn(),
    logout: vi.fn(),
    accessToken: null,
    user: null,
    isLoggedIn: false,
  })),
}))

import Login from '@/pages/Auth/Login'
import axios from 'axios'

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockClear()
})

describe('Login page', () => {
  test('renders email and password fields and submit button', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  test('submitting empty form shows validation errors', async () => {
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  test('on successful API response, navigates to /dashboard', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        user: { id: 1, email: 'rahul@example.com', full_name: 'Rahul Sharma' },
        accessToken: 'test-token-xyz',
      },
    })

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/email/i), 'rahul@example.com')
    await user.type(screen.getByLabelText(/password/i), 'securePass1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('on 401 API response, shows invalid credentials error', async () => {
    const error = {
      response: {
        status: 401,
        data: { message: 'Invalid email or password' },
      },
    }
    axios.post.mockRejectedValueOnce(error)

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/password/i), 'badPass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  test('submit button is disabled while request is in-flight', async () => {
    let resolve
    axios.post.mockImplementationOnce(() => new Promise((r) => { resolve = r }))

    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/email/i), 'rahul@example.com')
    await user.type(screen.getByLabelText(/password/i), 'validPass1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })

    // Resolve to cleanup
    resolve({ data: { user: {}, accessToken: '' } })
  })

  test('shows link to register page', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument()
  })
})
