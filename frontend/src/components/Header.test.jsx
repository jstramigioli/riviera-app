import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, title, role, className }) => (
    <a href={to} title={title} role={role} className={className}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/', search: '' }),
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

vi.mock('./GlobalNavSearch', () => ({
  default: () => (
    <input
      type="search"
      aria-label="Buscar reservas, clientes o consultas"
      placeholder="Buscar reservas, clientes…"
    />
  ),
}))

describe('Header', () => {
  it('agrupa Alojamiento con ítems bajo hover y mantiene el resto del nav', () => {
    render(<Header />)
    expect(screen.getByText('Alojamiento')).toBeInTheDocument()
    expect(screen.getByText('Libro de reservas')).toBeInTheDocument()
    expect(screen.getByText('Consultas')).toBeInTheDocument()
    expect(screen.getByText('Reservas')).toBeInTheDocument()
    expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Estado de cuentas')).toBeInTheDocument()
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
    expect(screen.queryByText('Consultas y Reservas')).not.toBeInTheDocument()

    // Menú por hover: display:none hasta hover (accesible con hidden:true)
    expect(
      screen.getByRole('menuitem', { name: 'Libro de reservas', hidden: true })
    ).toHaveAttribute('href', '/libro-de-reservas')
    expect(
      screen.getByRole('menuitem', { name: 'Consultas', hidden: true })
    ).toHaveAttribute('href', '/consultas-reservas?section=consultas')
    expect(
      screen.getByRole('menuitem', { name: 'Reservas', hidden: true })
    ).toHaveAttribute('href', '/consultas-reservas?section=reservas')
    expect(
      screen.getByRole('menuitem', { name: 'Habitaciones', hidden: true })
    ).toHaveAttribute('href', '/habitaciones')
    expect(
      screen.getByRole('menuitem', { name: 'Clientes', hidden: true })
    ).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Estado de cuentas' })).toBeInTheDocument()
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

  it('muestra la barra de búsqueda global a la derecha', () => {
    render(<Header />)
    expect(
      screen.getByRole('searchbox', {
        name: 'Buscar reservas, clientes o consultas'
      })
    ).toBeInTheDocument()
  })
})
