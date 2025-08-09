import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Configuracion from './Configuracion'

// Mock de los componentes de configuración
vi.mock('../components/configuracion/HabitacionesTab', () => ({
  default: () => <div data-testid="habitaciones-tab">Habitaciones Tab</div>
}))

vi.mock('../components/configuracion/EtiquetasTab', () => ({
  default: () => <div data-testid="etiquetas-tab">Etiquetas Tab</div>
}))

vi.mock('../components/configuracion/DynamicPricingConfigPanel', () => ({
  default: () => <div data-testid="dynamic-pricing-tab">Dynamic Pricing Tab</div>
}))

vi.mock('../components/configuracion/SeasonalCurveWrapper', () => ({
  default: () => <div data-testid="seasonal-curve-tab">Seasonal Curve Tab</div>
}))

vi.mock('../components/configuracion/MealPricingEditor', () => ({
  default: () => <div data-testid="meal-pricing-tab">Meal Pricing Tab</div>
}))

vi.mock('../components/configuracion/OperationalPeriodsPanel', () => ({
  default: () => <div data-testid="operational-periods-tab">Operational Periods Tab</div>
}))

vi.mock('../components/configuracion/TarifasPreviewPanel', () => ({
  default: () => <div data-testid="tarifas-preview-tab">Tarifas Preview Tab</div>
}))

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('Configuracion', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('habitaciones')
    localStorageMock.setItem.mockClear()
  })

  it('renders the configuration page title', () => {
    render(<Configuracion />)
    expect(screen.getByText('Hotel Riviera - Configuración')).toBeInTheDocument()
  })

  it('renders navigation tabs', () => {
    render(<Configuracion />)
    expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    expect(screen.getByText('Tarifas')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('shows habitaciones tab by default', () => {
    render(<Configuracion />)
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
    expect(screen.getByTestId('etiquetas-tab')).toBeInTheDocument()
  })

  it('switches to tarifas tab when clicked', () => {
    render(<Configuracion />)
    
    const tarifasTab = screen.getByText('Tarifas')
    fireEvent.click(tarifasTab)
    
    expect(screen.getByTestId('dynamic-pricing-tab')).toBeInTheDocument()
  })

  it('switches back to habitaciones tab', () => {
    render(<Configuracion />)
    
    // Cambiar a tarifas
    const tarifasTab = screen.getByText('Tarifas')
    fireEvent.click(tarifasTab)
    
    // Cambiar de vuelta a habitaciones
    const habitacionesTab = screen.getByText('Habitaciones')
    fireEvent.click(habitacionesTab)
    
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
  })

  it('saves active tab to localStorage', () => {
    render(<Configuracion />)
    
    const tarifasTab = screen.getByText('Tarifas')
    fireEvent.click(tarifasTab)
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('configActiveTab', 'tarifas')
  })
}) 