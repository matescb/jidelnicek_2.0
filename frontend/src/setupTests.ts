// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'

// Mock import.meta for Vite compatibility
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: false,
        VITE_API_URL: '/api/v1',
        VITE_USE_MOCK_AUTH: 'true',
      },
    },
  },
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock File and Blob APIs
global.File = class MockFile {
  constructor(public name: string, public type = 'text/plain', public size = 1024) {}
  arrayBuffer() { return Promise.resolve(new ArrayBuffer(this.size)) }
  text() { return Promise.resolve('mock file content') }
  stream() { return new ReadableStream() }
  slice() { return new Blob() }
} as any

global.Blob = class MockBlob {
  constructor(public size = 1024, public type = 'text/plain') {}
  arrayBuffer() { return Promise.resolve(new ArrayBuffer(this.size)) }
  text() { return Promise.resolve('mock blob content') }
  stream() { return new ReadableStream() }
  slice() { return new Blob() }
} as any

// Mock FileReader
global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = null
  readyState = 0
  onload = vi.fn()
  onerror = vi.fn()
  onloadend = vi.fn()
  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,mock-data`
    this.readyState = 2
    setTimeout(() => this.onload?.({ target: this } as any), 0)
  }
  readAsText(file: File) {
    this.result = 'mock file content'
    this.readyState = 2
    setTimeout(() => this.onload?.({ target: this } as any), 0)
  }
  readAsArrayBuffer(file: File) {
    this.result = new ArrayBuffer(file.size || 1024)
    this.readyState = 2
    setTimeout(() => this.onload?.({ target: this } as any), 0)
  }
  abort() {}
} as any

// Mock window methods
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
window.print = vi.fn()

// Mock scrollTo
window.scrollTo = vi.fn()
Element.prototype.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

// Mock HTMLElement methods
HTMLElement.prototype.focus = vi.fn()
HTMLElement.prototype.blur = vi.fn()

// Mock localStorage and sessionStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },
  writable: true,
})

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },
  writable: true,
})

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))

// Mock getComputedStyle
window.getComputedStyle = vi.fn(() => ({
  getPropertyValue: vi.fn(),
  setProperty: vi.fn(),
  removeProperty: vi.fn(),
})) as any

// Suppress React Router v7 deprecation warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('React Router Future Flag Warning')
    ) {
      return
    }
    originalWarn.apply(console, args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => {
    return {
      t: (key: string) => key,
      i18n: {
        changeLanguage: vi.fn(),
        language: 'en',
      },
    }
  },
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})