/* eslint-env jest */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock de fetch global
global.fetch = vi.fn()

// localStorage / sessionStorage en memoria (persisten get/set como el browser)
function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: vi.fn((key) => (store.has(String(key)) ? store.get(String(key)) : null)),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(String(key))
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    get length() {
      return store.size
    },
    key: vi.fn((index) => Array.from(store.keys())[index] ?? null)
  }
}
global.localStorage = createMemoryStorage()
global.sessionStorage = createMemoryStorage()

// Mock de window.matchMedia
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

// Mock de ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) 