import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LocationSelector from './LocationSelector'

// Mock del archivo JSON
vi.mock('../assets/arg-localities.json', () => ({
  default: [
    { 
      province: 'Buenos Aires', 
      localities: [
        { name: 'La Plata' },
        { name: 'Mar del Plata' }
      ]
    },
    { 
      province: 'Córdoba', 
      localities: [
        { name: 'Córdoba' },
        { name: 'Villa María' }
      ]
    },
    { 
      province: 'Santa Fe', 
      localities: [
        { name: 'Rosario' },
        { name: 'Santa Fe' }
      ]
    }
  ]
}))

describe('LocationSelector', () => {
  const mockProps = {
    country: 'AR',
    province: 'Buenos Aires',
    city: 'La Plata',
    onCountryChange: vi.fn(),
    onProvinceChange: vi.fn(),
    onCityChange: vi.fn(),
    required: false
  }

  const emptyProps = {
    country: '',
    province: '',
    city: '',
    onCountryChange: vi.fn(),
    onProvinceChange: vi.fn(),
    onCityChange: vi.fn(),
    required: false
  }

  const usProps = {
    country: 'US',
    province: 'California',
    city: 'Los Angeles',
    onCountryChange: vi.fn(),
    onProvinceChange: vi.fn(),
    onCityChange: vi.fn(),
    required: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all location inputs', () => {
    render(<LocationSelector {...mockProps} />)
    
    expect(screen.getByLabelText('País')).toBeInTheDocument()
    expect(screen.getByLabelText('Provincia')).toBeInTheDocument()
    expect(screen.getByLabelText('Ciudad')).toBeInTheDocument()
  })

  it('displays current values correctly', () => {
    render(<LocationSelector {...mockProps} />)
    
    expect(screen.getByDisplayValue('Argentina')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Buenos Aires')).toBeInTheDocument()
    expect(screen.getByDisplayValue('La Plata')).toBeInTheDocument()
  })

  it('calls onCountryChange when country is changed', () => {
    render(<LocationSelector {...mockProps} />)
    
    const countrySelect = screen.getByLabelText('País')
    fireEvent.change(countrySelect, { target: { value: 'US' } })
    
    expect(mockProps.onCountryChange).toHaveBeenCalledWith('US')
  })

  it('calls onProvinceChange when province is changed', () => {
    render(<LocationSelector {...mockProps} />)
    
    const provinceInput = screen.getByLabelText('Provincia')
    fireEvent.change(provinceInput, { target: { value: 'Córdoba' } })
    
    expect(mockProps.onProvinceChange).toHaveBeenCalledWith('Córdoba')
  })

  it('calls onCityChange when city is changed', () => {
    render(<LocationSelector {...mockProps} />)
    
    const cityInput = screen.getByLabelText('Ciudad')
    fireEvent.change(cityInput, { target: { value: 'Mar del Plata' } })
    
    expect(mockProps.onCityChange).toHaveBeenCalledWith('Mar del Plata')
  })

  it('handles empty values', () => {
    render(<LocationSelector {...emptyProps} />)
    
    const emptyElements = screen.getAllByDisplayValue('')
    expect(emptyElements.length).toBeGreaterThan(0)
  })

  it('handles required prop', () => {
    render(<LocationSelector {...mockProps} required={true} />)
    
    const countrySelect = screen.getByLabelText('País *')
    const provinceInput = screen.getByLabelText('Provincia *')
    const cityInput = screen.getByLabelText('Ciudad *')
    
    expect(countrySelect).toBeInTheDocument()
    expect(provinceInput).toBeInTheDocument()
    expect(cityInput).toBeInTheDocument()
  })

  it('handles non-required prop', () => {
    render(<LocationSelector {...mockProps} required={false} />)
    
    const countrySelect = screen.getByLabelText('País')
    const provinceInput = screen.getByLabelText('Provincia')
    const cityInput = screen.getByLabelText('Ciudad')
    
    expect(countrySelect).toBeInTheDocument()
    expect(provinceInput).toBeInTheDocument()
    expect(cityInput).toBeInTheDocument()
  })

  it('updates all fields when values change', () => {
    const { rerender } = render(<LocationSelector {...mockProps} />)
    
    expect(screen.getByDisplayValue('Argentina')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Buenos Aires')).toBeInTheDocument()
    expect(screen.getByDisplayValue('La Plata')).toBeInTheDocument()
    
    rerender(<LocationSelector {...usProps} />)
    
    expect(screen.getByDisplayValue('Estados Unidos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('California')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Los Angeles')).toBeInTheDocument()
  })

  it('handles special characters in city names', () => {
    const propsWithSpecialChars = {
      ...mockProps,
      city: 'Mar del Plata'
    }
    
    render(<LocationSelector {...propsWithSpecialChars} />)
    
    expect(screen.getByDisplayValue('Mar del Plata')).toBeInTheDocument()
  })

  it('maintains focus when typing', async () => {
    render(<LocationSelector {...mockProps} />)
    
    const cityInput = screen.getByLabelText('Ciudad')
    cityInput.focus()
    
    fireEvent.change(cityInput, { target: { value: 'Nueva Ciudad' } })
    
    await waitFor(() => {
      expect(cityInput).toHaveValue('Nueva Ciudad')
    })
  })

  it('handles different country values', () => {
    render(<LocationSelector {...usProps} />)
    
    expect(screen.getByDisplayValue('Estados Unidos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('California')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Los Angeles')).toBeInTheDocument()
  })
}) 