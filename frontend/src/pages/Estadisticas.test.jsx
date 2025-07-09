import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Estadisticas from './Estadisticas'

// Mock de react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/estadisticas' }),
}))

// Mock de los componentes
vi.mock('../components/ClientStats', () => ({
  default: () => <div data-testid="client-stats">Client Stats Component</div>
}))

describe('Estadisticas', () => {
  it('renders loading state initially', () => {
    render(<Estadisticas />)
    expect(screen.getByText('Cargando clientes...')).toBeInTheDocument()
  })

  it('renders loading spinner', () => {
    render(<Estadisticas />)
    const spinner = screen.getByText('Cargando clientes...').closest('div')
    expect(spinner).toHaveClass('_loading_b124bf')
  })

  it('has correct container structure', () => {
    render(<Estadisticas />)
    const container = screen.getByText('Cargando clientes...').closest('div')
    expect(container).toHaveClass('_container_b124bf')
  })
}) 