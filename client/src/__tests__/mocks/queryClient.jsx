/**
 * Test utilities: QueryClient factory + renderWithProviders wrapper.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

/**
 * Creates a fresh QueryClient for each test.
 * retry: false  → don't retry failed queries in tests
 * gcTime: 0     → immediately GC cached data
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Render a component wrapped in QueryClientProvider + MemoryRouter.
 * @param {React.ReactNode} ui
 * @param {{ initialEntries?: string[], queryClient?: QueryClient }} options
 */
export function renderWithProviders(ui, options = {}) {
  const { initialEntries = ['/'], queryClient } = options
  const client = queryClient || createTestQueryClient()

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient: client,
  }
}
