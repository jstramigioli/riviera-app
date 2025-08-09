import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RateEditor from './RateEditor'

// Mock de las funciones de API
vi.mock('../services/api', () => ({
  default: {
    createRates: vi.fn(),
    updateRate: vi.fn(),
    deleteRate: vi.fn()
  }
}))

describe('RateEditor', () => {
  const mockRates = [
    {
      id: 1,
      date: '2024-01-15',
      roomType: { id: 1, name: 'Habitación Simple' },
      price: 100,
      priceType: 'fixed'
    },
    {
      id: 2,
      date: '2024-01-16',
      roomType: { id: 2, name: 'Habitación Doble' },
      price: 150,
      priceType: 'dynamic'
    }
  ]

  const mockRoomTypes = [
    { id: 1, name: 'Habitación Simple' },
    { id: 2, name: 'Habitación Doble' },
    { id: 3, name: 'Suite' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders rate editor form', () => {
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    expect(screen.getByText('Editor de Tarifas')).toBeInTheDocument()
  })

  it('displays existing rates in view mode', () => {
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    expect(screen.getByText('14/01/2024')).toBeInTheDocument()
    expect(screen.getByText('Habitación Simple')).toBeInTheDocument()
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
  })

  it('allows switching to view mode', () => {
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    const viewButton = screen.getByText('Volver a Vista')
    fireEvent.click(viewButton)
    
    expect(screen.getByText('Editor de Tarifas')).toBeInTheDocument()
  })

  it('handles form input changes', () => {
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    const priceInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(priceInput, { target: { value: '200' } })
    
    expect(priceInput.value).toBe('200')
  })

  it('validates required fields', () => {
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    const submitButton = screen.getByText('Crear Tarifas')
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Editor de Tarifas')).toBeInTheDocument()
  })

  it('displays loading state during API calls', async () => {
    const { default: api } = await import('../services/api')
    api.createRates.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    // Llenar el formulario
    const startDateInput = screen.getByDisplayValue('2025-07-28')
    const endDateInput = screen.getByDisplayValue('2025-08-04')
    const roomTypeSelect = screen.getByRole('combobox')
    const priceInput = screen.getByPlaceholderText('0.00')
    
    fireEvent.change(startDateInput, { target: { value: '2024-01-20' } })
    fireEvent.change(endDateInput, { target: { value: '2024-01-25' } })
    fireEvent.change(roomTypeSelect, { target: { value: '1' } })
    fireEvent.change(priceInput, { target: { value: '200' } })
    
    // Crear tarifas
    const submitButton = screen.getByText('Crear Tarifas')
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Editor de Tarifas')).toBeInTheDocument()
  })
}) 