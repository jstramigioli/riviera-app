import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ClientStats from './ClientStats'

describe('ClientStats', () => {
  const mockClients = [
    {
      id: 1,
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '123456789',
      country: 'AR',
      province: 'Buenos Aires',
      city: 'CABA',
      wantsPromotions: true
    },
    {
      id: 2,
      firstName: 'María',
      lastName: 'García',
      email: 'maria@example.com',
      phone: '987654321',
      country: 'AR',
      province: 'Córdoba',
      city: 'Córdoba',
      wantsPromotions: false
    },
    {
      id: 3,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      country: 'US',
      province: 'California',
      city: 'Los Angeles',
      wantsPromotions: true
    },
    {
      id: 4,
      firstName: 'Ana',
      lastName: 'López',
      country: 'AR',
      province: 'Buenos Aires',
      city: 'La Plata',
      wantsPromotions: true
    },
    {
      id: 5,
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      country: 'AR',
      province: 'Santa Fe',
      city: 'Rosario',
      wantsPromotions: false
    }
  ]

  it('displays summary information', () => {
    render(<ClientStats clients={mockClients} />)
    
    const fiveElements = screen.getAllByText('5')
    const fourElements = screen.getAllByText('4')
    const oneElements = screen.getAllByText('1')
    
    expect(fiveElements.length).toBeGreaterThan(0)
    expect(fourElements.length).toBeGreaterThan(0)
    expect(oneElements.length).toBeGreaterThan(0)
  })

  it('renders province distribution correctly', () => {
    render(<ClientStats clients={mockClients} />)
    
    // Verificar que aparecen las provincias
    const buenosAiresElements = screen.getAllByText('Buenos Aires')
    const cordobaElements = screen.getAllByText('Córdoba')
    const santaFeElements = screen.getAllByText('Santa Fe')
    
    expect(buenosAiresElements.length).toBeGreaterThan(0)
    expect(cordobaElements.length).toBeGreaterThan(0)
    expect(santaFeElements.length).toBeGreaterThan(0)
  })

  it('calculates percentages correctly', () => {
    const testClients = [
      { id: 1, country: 'AR', province: 'Buenos Aires' },
      { id: 2, country: 'AR', province: 'Buenos Aires' },
      { id: 3, country: 'AR', province: 'Córdoba' },
      { id: 4, country: 'US', province: 'California' }
    ]
    
    render(<ClientStats clients={testClients} />)
    
    // Buenos Aires tiene 2 clientes de 4 con provincia = 50%
    expect(screen.getByText(/2.*50\.0%/)).toBeInTheDocument()
  })

  it('handles empty client list', () => {
    render(<ClientStats clients={[]} />)
    
    const zeroElements = screen.getAllByText('0')
    expect(zeroElements.length).toBeGreaterThan(0)
  })

  it('handles clients without province', () => {
    const clientsWithoutProvince = [
      { id: 1, name: 'Cliente 1', country: 'AR', province: '' },
      { id: 2, name: 'Cliente 2', country: 'AR', province: '' }
    ]
    
    render(<ClientStats clients={clientsWithoutProvince} />)
    
    const twoElements = screen.getAllByText('2')
    expect(twoElements.length).toBeGreaterThan(0)
  })

  it('renders client statistics correctly', () => {
    render(<ClientStats clients={mockClients} />)
    
    expect(screen.getByText('📊 Resumen General')).toBeInTheDocument()
    expect(screen.getByText('🗺️ Distribución por Provincia')).toBeInTheDocument()
    expect(screen.getByText('📋 Detalle por Provincia')).toBeInTheDocument()
  })
}) 