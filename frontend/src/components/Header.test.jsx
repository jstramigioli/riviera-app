import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

// Mock de react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, title }) => <a href={to} title={title}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}))

describe('Header', () => {
  it('renders navigation links', () => {
    render(<Header />)
    expect(screen.getByText('Libro de Reservas')).toBeInTheDocument()
    expect(screen.getByText('Tarifas')).toBeInTheDocument()
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
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