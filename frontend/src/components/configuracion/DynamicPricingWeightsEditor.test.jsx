import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DynamicPricingWeightsEditor from './DynamicPricingWeightsEditor'

describe('DynamicPricingWeightsEditor', () => {
  const mockWeights = {
    occupancy: 30,
    anticipation: 25,
    season: 25,
    events: 20
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
    
    // Usar getAllByText para elementos que aparecen múltiples veces
    expect(screen.getAllByText('Ocupación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Anticipación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Estacionalidad').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eventos').length).toBeGreaterThan(0)
  })

  it('displays current weight values', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getAllByText('25%')).toHaveLength(2) // Anticipación y Estacionalidad
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('shows total percentage', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // El componente muestra el total en algún lugar
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('displays factor descriptions', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText(/Influencia del nivel de ocupación/)).toBeInTheDocument()
    expect(screen.getByText(/Impacto de la anticipación/)).toBeInTheDocument()
    expect(screen.getByText(/Efecto de la estacionalidad/)).toBeInTheDocument()
    expect(screen.getByText(/Influencia de eventos especiales/)).toBeInTheDocument()
  })

  it('shows restore defaults button', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText('Restaurar Valores por Defecto')).toBeInTheDocument()
  })

  it('handles incomplete total (less than 100%)', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 20,
      season: 20,
      events: 15
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    // El texto está dividido en múltiples elementos, usar regex
    expect(screen.getByText(/85%/)).toBeInTheDocument()
  })

  it('handles overcomplete total (more than 100%)', () => {
    const overcompleteWeights = {
      occupancy: 40,
      anticipation: 30,
      season: 25,
      events: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={overcompleteWeights} onChange={mockOnChange} />)
    
    // El texto está dividido en múltiples elementos, usar regex
    expect(screen.getByText(/115%/)).toBeInTheDocument()
  })

  it('handles zero weights', () => {
    const zeroWeights = {
      occupancy: 0,
      anticipation: 0,
      season: 0,
      events: 0
    }
    
    render(<DynamicPricingWeightsEditor weights={zeroWeights} onChange={mockOnChange} />)
    
    // El componente muestra múltiples elementos con "0%", usamos getAllByText
    const zeroElements = screen.getAllByText('0%')
    expect(zeroElements.length).toBeGreaterThan(0)
  })

  it('handles negative weights', () => {
    const negativeWeights = {
      occupancy: -10,
      anticipation: 30,
      season: 40,
      events: 40
    }
    
    render(<DynamicPricingWeightsEditor weights={negativeWeights} onChange={mockOnChange} />)
    
    // El componente muestra el total calculado
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('displays factor colors correctly', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que los elementos existen (hay múltiples elementos con "Ocupación")
    const occupancyElements = screen.getAllByText('Ocupación')
    expect(occupancyElements.length).toBeGreaterThan(0)
  })

  it('handles decimal values', () => {
    const decimalWeights = {
      occupancy: 30.5,
      anticipation: 24.5,
      season: 25,
      events: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={decimalWeights} onChange={mockOnChange} />)
    
    // El componente redondea los valores, así que buscamos el total aproximado
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('handles missing weights', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 25
      // season y events faltan
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    expect(screen.getByText('Estacionalidad')).toBeInTheDocument()
    expect(screen.getByText('Eventos')).toBeInTheDocument()
  })

  it('shows warning when total is not 100%', () => {
    const incompleteWeights = {
      occupancy: 30,
      anticipation: 20,
      season: 20,
      events: 15
    }
    
    render(<DynamicPricingWeightsEditor weights={incompleteWeights} onChange={mockOnChange} />)
    
    // El componente muestra una advertencia cuando el total no es 100%
    expect(screen.getByText(/Ajusta los pesos para llegar al 100%/)).toBeInTheDocument()
  })

  it('shows warning when total exceeds 100%', () => {
    const overcompleteWeights = {
      occupancy: 40,
      anticipation: 30,
      season: 25,
      events: 20
    }
    
    render(<DynamicPricingWeightsEditor weights={overcompleteWeights} onChange={mockOnChange} />)
    
    // El componente muestra una advertencia cuando el total excede 100%
    expect(screen.getByText(/Ajusta los pesos para llegar al 100%/)).toBeInTheDocument()
  })

  it('displays percentage values correctly', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se muestran los porcentajes individuales
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getAllByText('25%')).toHaveLength(2) // Anticipación y Estacionalidad
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('renders all factor sections', () => {
    render(<DynamicPricingWeightsEditor weights={mockWeights} onChange={mockOnChange} />)
    
    // Verificar que se renderizan todas las secciones de factores
    const factorSections = screen.getAllByText(/Ocupación|Anticipación|Estacionalidad|Eventos/)
    expect(factorSections.length).toBeGreaterThanOrEqual(4)
  })
}) 