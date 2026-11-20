import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Configuracion from './Configuracion'

const canMock = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    can: (permission) => canMock(permission),
  }),
}))

vi.mock('../components/configuracion/HabitacionesTab', () => ({
  default: () => <div data-testid="habitaciones-tab"> Habitaciones Tab</div>
}))

vi.mock('../components/configuracion/CargosTarifasTab', () => ({
  default: ({ forcedSubTab }) => (
    <div data-testid="cargos-tarifas-tab">Cargos y Tarifas Tab {forcedSubTab || ''}</div>
  )
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

vi.mock('../components/configuracion/MediosPagoTab', () => ({
  default: () => <div data-testid="medios-pago-tab">Medios Tab</div>
}))

vi.mock('../components/configuracion/PromocionesTab', () => ({
  default: () => <div data-testid="promociones-tab">Promociones Tab</div>
}))

vi.mock('../components/configuracion/UsuariosTab', () => ({
  default: () => <div data-testid="usuarios-tab">Usuarios Tab</div>
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
    canMock.mockImplementation(
      (permission) => permission === 'settings' || permission === 'auditoria'
    )
  })

  it('renders the configuration page title', () => {
    renderConfig()
    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
  })

  it('renders text-only sidebar sections including Auditoría, without Usuarios', () => {
    renderConfig()
    const nav = screen.getByRole('navigation', { name: 'Secciones de configuración' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hotel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Habitaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargos y Tarifas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menú' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auditoría' })).toBeInTheDocument()
    expect(nav.querySelector('svg')).toBeNull()
  })

  it('muestra Usuarios solo con permiso users', () => {
    canMock.mockImplementation(
      (permission) =>
        permission === 'settings' ||
        permission === 'users' ||
        permission === 'auditoria'
    )
    renderConfig()
    expect(screen.getByRole('button', { name: 'Usuarios' })).toBeInTheDocument()
  })

  it('gerencia solo ve secciones de su rol', () => {
    canMock.mockImplementation(
      (permission) =>
        permission === 'mediosPago' ||
        permission === 'promociones' ||
        permission === 'auditoria'
    )
    localStorageMock.getItem.mockReturnValue(null)
    renderConfig()
    expect(screen.getByRole('button', { name: 'Medios de pago' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Promociones y descuentos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auditoría' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hotel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Habitaciones' })).toBeNull()
  })

  it('buscador filtra secciones y muestra subsecciones', () => {
    renderConfig()
    fireEvent.change(screen.getByLabelText('Buscar sección'), { target: { value: 'servicios' } })
    expect(screen.getByRole('button', { name: 'Cargos y Tarifas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Servicios' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hotel' })).toBeNull()
  })

  it('click en subsección abre Cargos y Tarifas con ese sub', () => {
    renderConfig()
    fireEvent.change(screen.getByLabelText('Buscar sección'), { target: { value: 'consumos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consumos' }))
    expect(screen.getByTestId('cargos-tarifas-tab')).toHaveTextContent('consumos')
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
