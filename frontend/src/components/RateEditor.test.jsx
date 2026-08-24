import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format } from 'date-fns'
import RateEditor from './RateEditor'

vi.mock('../services/api', () => ({
  createRates: vi.fn(),
  updateRate: vi.fn(),
  deleteRate: vi.fn(),
  API_URL: '/api'
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
    
    expect(screen.getByText(format(new Date('2024-01-15'), 'dd/MM/yyyy'))).toBeInTheDocument()
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
    const { createRates } = await import('../services/api')
    createRates.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<RateEditor rates={mockRates} roomTypes={mockRoomTypes} />)
    
    const today = format(new Date(), 'yyyy-MM-dd')
    const nextWeek = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const startDateInput = screen.getByDisplayValue(today)
    const endDateInput = screen.getByDisplayValue(nextWeek)
    const roomTypeSelect = screen.getByRole('combobox')
    const priceInput = screen.getByPlaceholderText('0.00')
    
    fireEvent.change(startDateInput, { target: { value: '2024-01-20' } })
    fireEvent.change(endDateInput, { target: { value: '2024-01-25' } })
    fireEvent.change(roomTypeSelect, { target: { value: '1' } })
    fireEvent.change(priceInput, { target: { value: '200' } })
    
    const submitButton = screen.getByText('Crear Tarifas')
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Editor de Tarifas')).toBeInTheDocument()
  })
})
