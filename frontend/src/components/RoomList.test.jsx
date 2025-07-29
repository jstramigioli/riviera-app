import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RoomList from './RoomList'

// Mock de la función fetchRooms
vi.mock('../services/api.js', () => ({
  fetchRooms: vi.fn()
}))

describe('RoomList', () => {
  const mockRooms = [
    {
      id: 1,
      name: 'Habitación 101',
      capacity: 2,
      status: 'available',
      tags: ['vista al mar', 'balcón']
    },
    {
      id: 2,
      name: 'Habitación 102',
      capacity: 4,
      status: 'occupied',
      tags: ['suite', 'jacuzzi']
    },
    {
      id: 3,
      name: 'Habitación 103',
      capacity: 2,
      status: 'maintenance',
      tags: []
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', async () => {
    const { fetchRooms } = await import('../services/api.js')
    fetchRooms.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<RoomList />)
    
    expect(screen.getByText('Cargando habitaciones...')).toBeInTheDocument()
  })

  it('displays rooms when data loads successfully', async () => {
    const { fetchRooms } = await import('../services/api.js')
    fetchRooms.mockResolvedValue(mockRooms)
    
    render(<RoomList />)
    
    await waitFor(() => {
      expect(screen.getByText('Habitación 101')).toBeInTheDocument()
      expect(screen.getByText('Habitación 102')).toBeInTheDocument()
      expect(screen.getByText('Habitación 103')).toBeInTheDocument()
    })
  })

  it('handles empty room list', async () => {
    const { fetchRooms } = await import('../services/api.js')
    fetchRooms.mockResolvedValue([])
    
    render(<RoomList />)
    
    await waitFor(() => {
      expect(screen.getByText('Habitaciones')).toBeInTheDocument()
    })
  })

  it('calls fetchRooms on mount', async () => {
    const { fetchRooms } = await import('../services/api.js')
    fetchRooms.mockResolvedValue(mockRooms)
    
    render(<RoomList />)
    
    expect(fetchRooms).toHaveBeenCalled()
  })
}) 