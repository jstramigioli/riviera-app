import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Configuracion from './Configuracion'

vi.mock('../components/configuracion/HabitacionesTab', () => ({
  default: () => <div data-testid="habitaciones-tab">Habitaciones Tab</div>
}))

vi.mock('../components/configuracion/CargosTarifasTab', () => ({
  default: () => <div data-testid="cargos-tarifas-tab">Cargos y Tarifas Tab</div>
}))

vi.mock('../components/configuracion/HotelConfigPanel', () => ({
  default: () => <div data-testid="hotel-tab">Hotel Tab</div>
}))

vi.mock('../components/configuracion/CalendarioTab', () => ({
  default: () => <div data-testid="calendario-tab">Calendario Tab</div>
}))

vi.mock('../components/TipoCambioConfig', () => ({
  default: () => <div data-testid="tipo-cambio-tab">Tipo de Cambio Tab</div>
}))

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
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('renders navigation tabs', () => {
    render(<Configuracion />)
    expect(screen.getByText('Hotel')).toBeInTheDocument()
    expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    expect(screen.getByText('Categorías de Cargos')).toBeInTheDocument()
    expect(screen.getByText('Calendario')).toBeInTheDocument()
    expect(screen.getByText('Tipo de Cambio')).toBeInTheDocument()
  })

  it('shows habitaciones tab by default', () => {
    render(<Configuracion />)
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
  })

  it('switches to hotel tab when clicked', () => {
    render(<Configuracion />)

    fireEvent.click(screen.getByText('Hotel'))

    expect(screen.getByTestId('hotel-tab')).toBeInTheDocument()
  })

  it('switches back to habitaciones tab', () => {
    render(<Configuracion />)

    fireEvent.click(screen.getByText('Calendario'))
    fireEvent.click(screen.getByText('Habitaciones'))

    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
  })

  it('saves active tab to localStorage', () => {
    render(<Configuracion />)

    fireEvent.click(screen.getByText('Tipo de Cambio'))

    expect(localStorageMock.setItem).toHaveBeenCalledWith('configActiveTab', 'tipo-cambio')
  })
})
