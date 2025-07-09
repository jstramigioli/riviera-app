import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Configuracion from './Configuracion'

// Mock de react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/configuracion' }),
}))

// Mock de los componentes
vi.mock('../components/configuracion/HabitacionesTab', () => ({
  default: () => <div data-testid="habitaciones-tab">Habitaciones Tab</div>
}))

vi.mock('../components/configuracion/EtiquetasTab', () => ({
  default: () => <div data-testid="etiquetas-tab">Etiquetas Tab</div>
}))

describe('Configuracion', () => {
  it('renders the configuration page title', () => {
    render(<Configuracion />)
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('renders navigation breadcrumb', () => {
    render(<Configuracion />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('renders tab navigation', () => {
    render(<Configuracion />)
    expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('shows habitaciones tab by default', () => {
    render(<Configuracion />)
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('etiquetas-tab')).not.toBeInTheDocument()
  })

  it('switches to etiquetas tab when clicked', () => {
    render(<Configuracion />)
    
    const etiquetasTab = screen.getByText('Sistema')
    fireEvent.click(etiquetasTab)
    
    expect(screen.getByTestId('etiquetas-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('habitaciones-tab')).not.toBeInTheDocument()
  })

  it('switches back to habitaciones tab', () => {
    render(<Configuracion />)
    
    // Switch to sistema first
    const sistemaTab = screen.getByText('Sistema')
    fireEvent.click(sistemaTab)
    
    // Switch back to habitaciones
    const habitacionesTab = screen.getByText('Habitaciones')
    fireEvent.click(habitacionesTab)
    
    expect(screen.getByTestId('habitaciones-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('etiquetas-tab')).not.toBeInTheDocument()
  })

  it('has correct page structure', () => {
    render(<Configuracion />)
    const title = screen.getByText('Hotel Riviera - Configuración')
    expect(title).toBeInTheDocument()
  })

  it('renders page header with icon', () => {
    render(<Configuracion />)
    const header = screen.getByText('Hotel Riviera - Configuración')
    expect(header).toBeInTheDocument()
  })
}) 