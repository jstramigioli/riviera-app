import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, title }) => <a href={to} title={title}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'admin', displayName: 'Administrador', role: 'ADMIN' },
    can: () => true,
    logout: vi.fn(),
    switchUser: vi.fn(),
  }),
}))

describe('Header', () => {
  it('renders navigation links', () => {
    render(<Header />)
    expect(screen.getByText('Libro de Reservas')).toBeInTheDocument()
    expect(screen.getByText('Consultas y Reservas')).toBeInTheDocument()
    expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    expect(screen.getByText('Estado de cuentas')).toBeInTheDocument()
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()

    const links = screen.getAllByRole('link').map((link) => link.textContent)
    const consultasIdx = links.indexOf('Consultas y Reservas')
    const habitacionesIdx = links.indexOf('Habitaciones')
    const cuentasIdx = links.indexOf('Estado de cuentas')
    expect(consultasIdx).toBeGreaterThanOrEqual(0)
    expect(habitacionesIdx).toBeGreaterThan(consultasIdx)
    expect(cuentasIdx).toBeGreaterThan(habitacionesIdx)
  })

  it('does not render Tarifas, Precios inteligentes or Auditoría in top nav', () => {
    render(<Header />)
    expect(screen.queryByText('Tarifas')).not.toBeInTheDocument()
    expect(screen.queryByText('Precios Inteligentes')).not.toBeInTheDocument()
    expect(screen.queryByText('Auditoría')).not.toBeInTheDocument()
  })

  it('has correct navigation structure', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
  })

  it('renders configuration button', () => {
    render(<Header />)
    const configButton = screen.getByTitle('Configuración')
    expect(configButton).toBeInTheDocument()
  })
})
