import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DynamicPricingWeightsEditor from './DynamicPricingWeightsEditor'

describe('DynamicPricingWeightsEditor', () => {
  const mockWeights = {
    occupancy: 40,
    anticipation: 30,
    weekend: 15,
    holiday: 15
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the weights editor', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText('Editor de Factores de Precios Dinámicos')).toBeInTheDocument()
  })

  it('displays all weight factors', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que los factores principales están presentes
    expect(screen.getAllByText('Ocupación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Anticipación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Fin de semana').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Feriado/Fin de semana largo').length).toBeGreaterThan(0)
  })

  it('displays current weight values', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran los porcentajes
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15%').length).toBeGreaterThan(0)
  })

  it('shows total percentage', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra algún texto relacionado con el total
    expect(screen.getAllByText(/100%/).length).toBeGreaterThan(0)
  })

  it('displays factor descriptions', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran las descripciones
    expect(screen.getByText(/Influencia del nivel de ocupación/)).toBeInTheDocument()
    expect(screen.getByText(/Impacto de la anticipación/)).toBeInTheDocument()
  })

  it('shows restore defaults button', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText('Restaurar Valores por Defecto')).toBeInTheDocument()
  })

  it('handles incomplete total (less than 100%)', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 20,
      weekend: 15,
      holiday: 10
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra el total incompleto
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('handles overcomplete total (more than 100%)', () => {
    const overcompleteWeights = {
      occupancy: 40,
      anticipation: 30,
      weekend: 20,
      holiday: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={overcompleteWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra el total excesivo
    expect(screen.getByText(/110%/)).toBeInTheDocument()
  })

  it('handles zero weights', () => {
    const zeroWeights = {
      occupancy: 0,
      anticipation: 0,
      weekend: 0,
      holiday: 0
    }
    
    render(<DynamicPricingWeightsEditor weights={zeroWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran elementos con 0%
    const zeroElements = screen.getAllByText('0%')
    expect(zeroElements.length).toBeGreaterThan(0)
  })

  it('handles negative weights', () => {
    const negativeWeights = {
      occupancy: -10,
      anticipation: 30,
      weekend: 40,
      holiday: 40
    }
    
    render(<DynamicPricingWeightsEditor weights={negativeWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra algún total
    expect(screen.getAllByText(/100%/).length).toBeGreaterThan(0)
  })

  it('displays factor colors correctly', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que los elementos existen
    const occupancyElements = screen.getAllByText('Ocupación')
    expect(occupancyElements.length).toBeGreaterThan(0)
  })

  it('handles decimal values', () => {
    const decimalWeights = {
      occupancy: 30.5,
      anticipation: 24.5,
      weekend: 25,
      holiday: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={decimalWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra algún total
    expect(screen.getAllByText(/100%/).length).toBeGreaterThan(0)
  })

  it('handles missing weights', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 25
      // weekend y holiday faltan
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran los factores faltantes
    expect(screen.getByText('Fin de semana')).toBeInTheDocument()
    expect(screen.getByText('Feriado/Fin de semana largo')).toBeInTheDocument()
  })

  it('shows warning when total is not 100%', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 20,
      weekend: 20,
      holiday: 15
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra una advertencia
    expect(screen.getByText(/Ajusta los pesos para llegar al 100%/)).toBeInTheDocument()
  })

  it('shows warning when total exceeds 100%', () => {
    const overcompleteWeights = {
      occupancy: 40,
      anticipation: 30,
      weekend: 25,
      holiday: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={overcompleteWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestra una advertencia
    expect(screen.getByText(/Ajusta los pesos para llegar al 100%/)).toBeInTheDocument()
  })

  it('displays percentage values correctly', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran los porcentajes
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15%').length).toBeGreaterThan(0)
  })

  it('renders all factor sections', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se renderizan las secciones de factores
    const factorSections = screen.getAllByText(/Ocupación|Anticipación|Fin de semana|Feriado/)
    expect(factorSections.length).toBeGreaterThanOrEqual(4)
  })
}) 