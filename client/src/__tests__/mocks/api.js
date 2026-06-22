/**
 * Mock helpers for @/services/api (axios instance).
 * Usage:
 *   vi.mock('@/services/api', () => import('./mocks/api').then(m => ({ default: m.mockApi })))
 */
import { vi } from 'vitest'

// Shared mock api object returned for vi.mock
export const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}

/**
 * Helper to set up a mock GET response for a given path.
 * @param {string} _path  — informational only, not used in matching
 * @param {*} response    — the resolved data (will be wrapped in { data: response })
 */
export function mockApiGet(_path, response) {
  mockApi.get.mockResolvedValueOnce({ data: response })
}

/**
 * Helper to set up a mock POST response.
 */
export function mockApiPost(_path, response) {
  mockApi.post.mockResolvedValueOnce({ data: response })
}

/**
 * Helper to reject the next GET call (simulates network/server error).
 */
export function mockApiGetError(_path, error = new Error('Network Error')) {
  mockApi.get.mockRejectedValueOnce(error)
}

/**
 * Reset all mocks.
 */
export function resetApiMocks() {
  mockApi.get.mockReset()
  mockApi.post.mockReset()
  mockApi.put.mockReset()
  mockApi.delete.mockReset()
}
