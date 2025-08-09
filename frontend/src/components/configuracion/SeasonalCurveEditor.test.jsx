import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SeasonalCurveEditor from './SeasonalCurveEditor'

// Mock de fetch global
window.fetch = vi.fn()

// Mock de import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_API_URL: 'http://localhost:3001/api'
  }
}))

// Mock de Recharts para evitar errores de renderizado
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>
}))

describe('SeasonalCurveEditor', () => {
  const mockCoefficients = [
    { month: 1, value: 1.2 },
    { month: 2, value: 1.1 },
    { month: 3, value: 1.0 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock por defecto para evitar errores de fetch
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockCoefficients
    })
  })

  it('renders the component', () => {
    render(<SeasonalCurveEditor hotelId="1" />)
    expect(screen.getByText(/No hay fechas clave configuradas/)).toBeInTheDocument()
  })

  it('shows add button when no data', () => {
    render(<SeasonalCurveEditor hotelId="1" />)
    expect(screen.getByText(/Agregar primera fecha clave/)).toBeInTheDocument()
  })
}) 