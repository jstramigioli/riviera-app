import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Estadisticas from './Estadisticas'

// Mock de la API
vi.mock('../services/api', () => ({
  default: {
    fetchClients: vi.fn()
  }
}))

describe('Estadisticas', () => {
  it('shows loading state initially', () => {
    render(<Estadisticas />)
    expect(screen.getByText('Cargando clientes...')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    const api = await import('../services/api')
    api.default.fetchClients.mockRejectedValueOnce(new Error('API Error'))
    
    render(<Estadisticas />)
    
    const errorElement = await screen.findByText(/Error al cargar los clientes/)
    expect(errorElement).toBeInTheDocument()
  })

  it('renders statistics when data loads successfully', async () => {
    const mockClients = [
      { id: 1, name: 'Juan Pérez', email: 'juan@test.com', country: 'AR', wantsPromotions: true },
      { id: 2, name: 'María García', email: 'maria@test.com', country: 'AR', wantsPromotions: false }
    ]
    
    const api = await import('../services/api')
    api.default.fetchClients.mockResolvedValueOnce(mockClients)
    
    render(<Estadisticas />)
    
    // Esperar a que aparezcan las estadísticas
    await waitFor(() => {
      expect(screen.getByText('Total de Clientes')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Clientes Argentinos')).toBeInTheDocument()
  })

  it('has correct container structure when loaded', async () => {
    const mockClients = [
      { id: 1, name: 'Juan Pérez', email: 'juan@test.com', country: 'AR', wantsPromotions: true }
    ]
    
    const api = await import('../services/api')
    api.default.fetchClients.mockResolvedValueOnce(mockClients)
    
    render(<Estadisticas />)
    
    // Esperar a que se cargue el contenido
    await waitFor(() => {
      expect(screen.getByText('Total de Clientes')).toBeInTheDocument()
    })
    
    // Verificar que el contenedor principal existe
    const container = screen.getByText('📊 Estadísticas').closest('div')
    expect(container).toBeInTheDocument()
  })
}) 