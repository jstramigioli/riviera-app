import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

// Mock de react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}))

describe('Header', () => {
  it('renders the header with title', () => {
    render(<Header />)
    expect(screen.getByText('Riviera App')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Header />)
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('has correct navigation structure', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
  })
}) 