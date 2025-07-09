import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppData } from './useAppData'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchClients: vi.fn(),
  fetchRooms: vi.fn(),
  fetchReservations: vi.fn(),
  fetchRoomTypes: vi.fn(),
  fetchTags: vi.fn(),
  fetchDailyRates: vi.fn(),
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
      reservations: [],
      roomTypes: [],
      tags: [],
      dailyRates: []
    }

    const { fetchClients, fetchRooms, fetchReservations, fetchRoomTypes, fetchTags, fetchDailyRates } = await import('../services/api')
    
    fetchClients.mockResolvedValue(mockData.clients)
    fetchRooms.mockResolvedValue(mockData.rooms)
    fetchReservations.mockResolvedValue(mockData.reservations)
    fetchRoomTypes.mockResolvedValue(mockData.roomTypes)
    fetchTags.mockResolvedValue(mockData.tags)
    fetchDailyRates.mockResolvedValue(mockData.dailyRates)

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

  it('provides refresh function', () => {
    const { result } = renderHook(() => useAppData())
    
    expect(typeof result.current.refresh).toBe('function')
  })
}) 