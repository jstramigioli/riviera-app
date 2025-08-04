import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DynamicPricingConfigPanel from './DynamicPricingConfigPanel'

// Mock de fetch global
window.fetch = vi.fn()

// Mock de import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_API_URL: 'http://localhost:3001/api'
  }
}))

describe('DynamicPricingConfigPanel', () => {
  const mockConfig = {
    globalOccupancyWeight: 0.3,
    anticipationWeight: 0.25,
    isWeekendWeight: 0.3,
    isHolidayWeight: 0.15,
    maxAdjustmentPercentage: 0.4,
    anticipationThresholds: [21, 14, 7, 3],
    enableGapPromos: true,
    enableWeatherApi: false,
    enableRecentDemand: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock por defecto para evitar errores de fetch
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockConfig
    })
  })

  it('renders the panel title', async () => {
    render(<DynamicPricingConfigPanel />)
    
    // Esperar a que termine la carga
    await waitFor(() => {
      expect(screen.getByText(/Configuración de Tarifas Dinámicas/)).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<DynamicPricingConfigPanel />)
    expect(screen.getByText(/Cargando configuración/)).toBeInTheDocument()
  })

  it('renders configuration form when data loads', async () => {
    render(<DynamicPricingConfigPanel />)
    
    // Esperar a que aparezca el formulario o la advertencia de precios desactivados
    await waitFor(() => {
      expect(screen.getByText(/Precios dinámicos desactivados/)).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    window.fetch.mockRejectedValueOnce(new Error('Network error'))
    
    render(<DynamicPricingConfigPanel />)
    
    // El componente no muestra errores, solo continúa con la configuración por defecto
    await waitFor(() => {
      expect(screen.getByText(/Configuración de Tarifas Dinámicas/)).toBeInTheDocument()
    })
  })
}) 