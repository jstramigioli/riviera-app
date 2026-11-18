import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MEDIA_PENSION_MENU_CLAVE,
  loadMediaPensionMenu,
  saveMediaPensionMenu
} from './mediaPensionMenuStore'

vi.mock('../services/api', () => ({
  getConfiguracion: vi.fn(),
  upsertConfiguracion: vi.fn()
}))

import { getConfiguracion, upsertConfiguracion } from '../services/api'

const memory = new Map()
const localStorageMock = {
  getItem: vi.fn((key) => (memory.has(key) ? memory.get(key) : null)),
  setItem: vi.fn((key, value) => {
    memory.set(key, String(value))
  }),
  removeItem: vi.fn((key) => {
    memory.delete(key)
  }),
  clear: vi.fn(() => {
    memory.clear()
  })
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
})

describe('mediaPensionMenuStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memory.clear()
  })

  it('carga desde configuracion por fecha', async () => {
    getConfiguracion.mockResolvedValue({
      clave: MEDIA_PENSION_MENU_CLAVE,
      valor: JSON.stringify({ '2026-11-18': 'Milanesa + ensalada' })
    })
    const text = await loadMediaPensionMenu('2026-11-18')
    expect(text).toBe('Milanesa + ensalada')
    expect(getConfiguracion).toHaveBeenCalledWith(MEDIA_PENSION_MENU_CLAVE)
  })

  it('si no hay config, usa localStorage', async () => {
    getConfiguracion.mockRejectedValue(new Error('404'))
    localStorage.setItem(
      'riviera.mediaPensionMenu.byDate',
      JSON.stringify({ '2026-11-18': 'Local only' })
    )
    const text = await loadMediaPensionMenu('2026-11-18')
    expect(text).toBe('Local only')
  })

  it('guarda en config y localStorage', async () => {
    getConfiguracion.mockRejectedValue(new Error('404'))
    upsertConfiguracion.mockResolvedValue({ clave: MEDIA_PENSION_MENU_CLAVE })
    const result = await saveMediaPensionMenu('2026-11-18', 'Sopa')
    expect(result).toEqual({ ok: true, source: 'config' })
    expect(upsertConfiguracion).toHaveBeenCalledWith(
      expect.objectContaining({
        clave: MEDIA_PENSION_MENU_CLAVE,
        valor: expect.stringContaining('Sopa')
      })
    )
    const stored = JSON.parse(localStorage.getItem('riviera.mediaPensionMenu.byDate'))
    expect(stored['2026-11-18']).toBe('Sopa')
  })

  it('si falla config, deja el menú en localStorage', async () => {
    getConfiguracion.mockRejectedValue(new Error('404'))
    upsertConfiguracion.mockRejectedValue(new Error('offline'))
    const result = await saveMediaPensionMenu('2026-11-19', 'Pasta')
    expect(result.ok).toBe(true)
    expect(result.source).toBe('local')
    const stored = JSON.parse(localStorage.getItem('riviera.mediaPensionMenu.byDate'))
    expect(stored['2026-11-19']).toBe('Pasta')
  })
})
