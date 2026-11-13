import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Configuracion from './Configuracion'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    can: (permission) => permission === 'settings' || permission === 'auditoria',
  }),
}))

vi.mock('../components/configuracion/HabitacionesTab', () => ({
  default: () => <div data-testid="habitaciones-tab"> Habitaciones Tab</div>
}))

vi.mock('../components/configuracion/CargosTarifasTab', () => ({
  default: () => <div data-testid="cargos-tarifas-tab">Cargos y Tarifas Tab</div>
}))

vi.mock('../components/configuracion/MenuConsumosTab', () => ({
  default: () => <div data-testid="menu-consumos-tab">Menú Tab</div>
}))

vi.mock('../components/configuracion/HotelConfigPanel', () => ({
  default: () => <div data-testid="hotel-tab">Hotel Tab</div>
}))

vi.mock('../components/configuracion/CalendarioTab', () => ({
  default: () => <div data-testid="calendario-tab">Calendario Tab</div>
}))

vi.mock('../components/TipoCambioConfig', () => ({
  default: () => <div data-testid="tipo-cambio-tab">Tipo Cambio Tab</div>
}))

vi.mock('./Auditoria', () => ({
  default: () => <div data-testid="auditoria-tab">Auditoría Tab</div>
}))

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

function renderConfig() {
  return render(
    <MemoryRouter>
      <Configuracion />
    </MemoryRouter>
  )
}

describe('Configuracion', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('habitaciones')
    localStorageMock.setItem.mockClear()
  })

  it('renders the configuration page title', () => {
    renderConfig()
    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
  })

  it('renders text-only sidebar sections including Auditoría', () => {
    renderConfig()
    const nav = screen.getByRole('navigation', { name: 'Secciones de configuración' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hotel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Habitaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargos y Tarifas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menú' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auditoría' })).toBeInTheDocument()
    expect(nav.querySelector('svg')).toBeNull()
  })

  it('shows habitaciones tab by default', () => {
    renderConfig()
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
  })

  it('switches to cargos-tarifas tab when clicked', () => {
    renderConfig()
    fireEvent.click(screen.getByText('Cargos y Tarifas'))
    expect(screen.getByTestId('cargos-tarifas-tab')).toBeInTheDocument()
  })

  it('switches to auditoria tab when clicked', () => {
    renderConfig()
    fireEvent.click(screen.getByText('Auditoría'))
    expect(screen.getByTestId('auditoria-tab')).toBeInTheDocument()
  })

  it('switches back to habitaciones tab', () => {
    renderConfig()
    fireEvent.click(screen.getByText('Cargos y Tarifas'))
    fireEvent.click(screen.getByText('Habitaciones'))
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
  })

  it('saves active tab to localStorage', () => {
    renderConfig()
    fireEvent.click(screen.getByText('Cargos y Tarifas'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('configActiveTab', 'cargos-tarifas')
  })
})
