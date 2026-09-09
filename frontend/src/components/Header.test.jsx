import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, title }) => <a href={to} title={title}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}))

describe('Header', () => {
  it('renders MVP navigation links without auto-rate menus', () => {
    render(<Header />)
    expect(screen.getByText('Libro de Reservas')).toBeInTheDocument()
    expect(screen.getByText('Reservas')).toBeInTheDocument()
    expect(screen.getByText('Cobros y Pagos')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.queryByText('Tarifas')).not.toBeInTheDocument()
    expect(screen.queryByText('Precios')).not.toBeInTheDocument()
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
