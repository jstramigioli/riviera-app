import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import OperationalPeriodsPanel from './OperationalPeriodsPanel'

// Mock de fetch global
window.fetch = vi.fn()

// Mock de import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_API_URL: 'http://localhost:3001/api'
  }
}))

describe('OperationalPeriodsPanel', () => {
  const mockPeriods = [
    {
      id: 1,
      name: 'Temporada Alta',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      multiplier: 1.5,
      isActive: true
    },
    {
      id: 2,
      name: 'Temporada Baja',
      startDate: '2024-04-01',
      endDate: '2024-06-30',
      multiplier: 0.8,
      isActive: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock por defecto para evitar errores de fetch
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockPeriods
    })
  })

  it('renders the panel title', async () => {
    render(<OperationalPeriodsPanel />)
    
    // Esperar a que termine la carga
    await waitFor(() => {
      expect(screen.getByText(/Períodos de Apertura y Cierre/)).toBeInTheDocument()
    })
  })

  it('shows periods list when data loads', async () => {
    render(<OperationalPeriodsPanel />)
    
    // Esperar a que aparezcan los períodos
    await waitFor(() => {
      expect(screen.getAllByText(/Editar/)).toHaveLength(2)
    })
  })

  it('shows error message when API fails', async () => {
    window.fetch.mockRejectedValueOnce(new Error('Network error'))
    
    render(<OperationalPeriodsPanel />)
    
    // Esperar a que aparezca el error
    await waitFor(() => {
      expect(screen.getByText(/Error/)).toBeInTheDocument()
    })
  })
}) 