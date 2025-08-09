import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppData } from './useAppData'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchClients: vi.fn(),
  fetchRooms: vi.fn(),
  fetchReservations: vi.fn(),
}))

// Mock de roomUtils
vi.mock('../utils/roomUtils', () => ({
  sortRooms: vi.fn((rooms) => rooms)
}))

describe('useAppData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useAppData())
    
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('loads data successfully', async () => {
    const mockData = {
      clients: [{ id: 1, name: 'Test Client' }],
      rooms: [{ id: 1, name: 'Room 101' }],
      reservations: []
    }

    const { fetchClients, fetchRooms, fetchReservations } = await import('../services/api')
    
    fetchClients.mockResolvedValue(mockData.clients)
    fetchRooms.mockResolvedValue(mockData.rooms)
    fetchReservations.mockResolvedValue(mockData.reservations)

    const { result } = renderHook(() => useAppData())

    await act(async () => {
      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.clients).toEqual(mockData.clients)
    expect(result.current.rooms).toEqual(mockData.rooms)
  })

  it('handles error state', async () => {
    const { fetchClients } = await import('../services/api')
    fetchClients.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useAppData())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('provides setter functions', () => {
    const { result } = renderHook(() => useAppData())
    
    expect(typeof result.current.setRooms).toBe('function')
    expect(typeof result.current.setClients).toBe('function')
    expect(typeof result.current.setReservations).toBe('function')
  })
}) 