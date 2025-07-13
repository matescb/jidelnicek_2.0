import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { server } from '../__mocks__/server'
import { cleanup } from '@testing-library/react'

// Mock environment variables for integration tests
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: false,
    VITE_API_URL: '/api/v1',
    VITE_USE_MOCK_AUTH: 'true',
    VITE_WS_URL: 'ws://localhost:3001',
    VITE_ENABLE_ANALYTICS: 'false',
    VITE_ENABLE_DEBUG: 'true',
  },
  writable: true,
})

// Enhanced console mocking for integration tests
const originalConsole = { ...console }

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  
  // Mock console methods for cleaner test output
  console.warn = vi.fn()
  console.error = vi.fn()
  console.info = vi.fn()
})

// Reset any request handlers that are declared as a part of our tests
beforeEach(() => {
  server.resetHandlers()
  
  // Clear all timers
  vi.clearAllTimers()
  
  // Reset localStorage and sessionStorage
  localStorage.clear()
  sessionStorage.clear()
  
  // Reset window location
  delete (window as any).location
  window.location = {
    ...window.location,
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  } as any
  
  // Reset fetch
  global.fetch = vi.fn()
  
  // Reset all mocks
  vi.clearAllMocks()
})

// Clean up after each test
afterEach(() => {
  cleanup()
  
  // Restore timers
  vi.useRealTimers()
  
  // Clear any remaining async operations
  vi.runAllTimers()
})

// Clean up after all tests are done
afterAll(() => {
  server.close()
  
  // Restore console
  Object.assign(console, originalConsole)
})

// Global test utilities
export const mockFetch = (response: any, options: { status?: number; ok?: boolean } = {}) => {
  const mockResponse = {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(response)])),
    headers: new Headers(),
    statusText: options.status === 200 ? 'OK' : 'Error',
    url: '',
    redirected: false,
    type: 'basic' as ResponseType,
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
  }
  
  ;(global.fetch as any).mockResolvedValueOnce(mockResponse)
  return mockResponse
}

export const mockFetchError = (error: Error | string) => {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  ;(global.fetch as any).mockRejectedValueOnce(errorObj)
}

// Network simulation utilities
export const simulateNetworkDelay = (ms: number = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const simulateNetworkError = () => {
  throw new Error('Network request failed')
}

export const simulateSlowNetwork = async <T>(promise: Promise<T>, delay: number = 2000): Promise<T> => {
  await simulateNetworkDelay(delay)
  return promise
}

// Authentication simulation
export const simulateAuthentication = (user: any = null) => {
  const defaultUser = {
    id: 'test-user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  const tokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }
  
  const userData = user || defaultUser
  
  // Store in localStorage (simulating persistence)
  localStorage.setItem('auth-storage', JSON.stringify({
    state: { tokens },
    version: 0,
  }))
  
  return { user: userData, tokens }
}

export const simulateLogout = () => {
  localStorage.removeItem('auth-storage')
  sessionStorage.clear()
}

// WebSocket simulation
export const createMockWebSocket = () => {
  const mockWS = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    url: 'ws://localhost:3001',
    protocol: '',
    extensions: '',
    binaryType: 'blob' as BinaryType,
    bufferedAmount: 0,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
  }
  
  global.WebSocket = vi.fn(() => mockWS) as any
  return mockWS
}

// Viewport simulation
export const simulateViewport = (width: number, height: number) => {
  Object.defineProperties(window, {
    innerWidth: { value: width, writable: true },
    innerHeight: { value: height, writable: true },
  })
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

export const simulateMobileViewport = () => simulateViewport(375, 667)
export const simulateTabletViewport = () => simulateViewport(768, 1024)
export const simulateDesktopViewport = () => simulateViewport(1920, 1080)

// Form interaction helpers
export const fillForm = async (user: any, formData: Record<string, string>) => {
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = await screen.findByLabelText(new RegExp(fieldName, 'i'))
    await user.clear(field)
    await user.type(field, value)
  }
}

export const submitForm = async (user: any, buttonText: string = 'submit') => {
  const submitButton = screen.getByRole('button', { name: new RegExp(buttonText, 'i') })
  await user.click(submitButton)
}

// Wait utilities
export const waitForSpinnerToDisappear = () => 
  waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

export const waitForLoadingToFinish = () => 
  waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

export const waitForErrorToAppear = () =>
  waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

// Navigation helpers
export const navigateToRoute = (path: string) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export const expectToBeOnRoute = (path: string) => {
  expect(window.location.pathname).toBe(path)
}

// Data generation utilities
export const generateLargeDataset = (count: number, generator: (index: number) => any) => {
  return Array.from({ length: count }, (_, index) => generator(index))
}

export const createMockRecipeData = (overrides: any = {}) => ({
  id: `recipe-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Recipe',
  description: 'A delicious test recipe',
  prepTime: 30,
  cookTime: 45,
  servings: 4,
  difficulty: 'medium',
  cuisine: 'Italian',
  category: 'Main Course',
  ingredients: [
    { id: '1', name: 'Pasta', amount: 500, unit: 'g' },
    { id: '2', name: 'Tomato sauce', amount: 400, unit: 'ml' },
  ],
  instructions: [
    { step: 1, description: 'Boil water' },
    { step: 2, description: 'Cook pasta' },
  ],
  nutrition: {
    calories: 350,
    protein: 12,
    carbs: 65,
    fat: 8,
  },
  tags: ['quick', 'easy'],
  imageUrl: 'https://example.com/recipe.jpg',
  rating: 4.5,
  ratingCount: 23,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const createMockTripData = (overrides: any = {}) => ({
  id: `trip-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Trip',
  description: 'A wonderful test trip',
  location: 'Test Location',
  startDate: '2024-06-01',
  endDate: '2024-06-07',
  participantCount: 4,
  status: 'planning',
  budget: 500,
  currency: 'USD',
  participants: [
    {
      id: 'participant-1',
      email: 'participant1@example.com',
      role: 'organizer',
      status: 'accepted',
      dietaryRestrictions: [],
    },
  ],
  mealSlots: [
    { id: 'breakfast', name: 'Breakfast', order: 1 },
    { id: 'lunch', name: 'Lunch', order: 2 },
    { id: 'dinner', name: 'Dinner', order: 3 },
  ],
  days: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

// Performance monitoring
export const measurePerformance = async (name: string, fn: () => Promise<void> | void) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  const duration = end - start
  
  console.log(`Performance measure [${name}]: ${duration.toFixed(2)}ms`)
  return duration
}

// Memory leak detection
export const detectMemoryLeaks = () => {
  if (typeof window !== 'undefined' && (window as any).gc) {
    const before = (performance as any).memory?.usedJSHeapSize
    ;(window as any).gc()
    const after = (performance as any).memory?.usedJSHeapSize
    
    if (before && after) {
      console.log(`Memory cleanup: ${before - after} bytes freed`)
    }
  }
}

export { screen, waitFor, within, fireEvent } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'