/* eslint-env jest */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateReservationOnServer, updateClientOnServer } from './apiUtils'

// Mock de la API
vi.mock('../services/api.js', () => ({
  fetchReservations: vi.fn(),
  fetchClients: vi.fn(),
  updateReservation: vi.fn(),
  updateClient: vi.fn(),
}))

describe('apiUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de alert
    global.alert = vi.fn()
  })

  describe('updateReservationOnServer', () => {
    it('updates reservation optimistically', async () => {
      const mockSetReservations = vi.fn()
      const mockUpdateReservation = (await import('../services/api.js')).updateReservation
      mockUpdateReservation.mockResolvedValue({ id: 1, status: 'confirmed' })

      const reservations = [{ id: 1, status: 'pending' }]
      mockSetReservations.mockImplementation((updater) => {
        const newReservations = updater(reservations)
        expect(newReservations[0].status).toBe('confirmed')
      })

      await updateReservationOnServer(1, { status: 'confirmed' }, mockSetReservations)

      expect(mockSetReservations).toHaveBeenCalled()
      expect(mockUpdateReservation).toHaveBeenCalledWith(1, { status: 'confirmed' })
    })

    it('reverts on error', async () => {
      const mockSetReservations = vi.fn()
      const mockUpdateReservation = (await import('../services/api.js')).updateReservation
      const mockFetchReservations = (await import('../services/api.js')).fetchReservations
      
      mockUpdateReservation.mockRejectedValue(new Error('Network error'))
      mockFetchReservations.mockResolvedValue([{ id: 1, status: 'pending' }])

      await expect(
        updateReservationOnServer(1, { status: 'confirmed' }, mockSetReservations)
      ).rejects.toThrow('Network error')

      expect(mockFetchReservations).toHaveBeenCalled()
      expect(global.alert).toHaveBeenCalledWith('Error de conexión. Los cambios se han revertido.')
    })
  })

  describe('updateClientOnServer', () => {
    it('updates client optimistically', async () => {
      const mockSetClients = vi.fn()
      const mockSetReservations = vi.fn()
      const mockUpdateClient = (await import('../services/api.js')).updateClient
      mockUpdateClient.mockResolvedValue({ id: 1, firstName: 'John', lastName: 'Doe' })

      const clients = [{ id: 1, firstName: 'Jane', lastName: 'Doe' }]
      mockSetClients.mockImplementation((updater) => {
        const newClients = updater(clients)
        expect(newClients[0].firstName).toBe('John')
      })

      await updateClientOnServer(1, { firstName: 'John' }, mockSetClients, mockSetReservations)

      expect(mockSetClients).toHaveBeenCalled()
      expect(mockUpdateClient).toHaveBeenCalledWith(1, { firstName: 'John' })
    })

    it('reverts on error', async () => {
      const mockSetClients = vi.fn()
      const mockSetReservations = vi.fn()
      const mockUpdateClient = (await import('../services/api.js')).updateClient
      const mockFetchClients = (await import('../services/api.js')).fetchClients
      const mockFetchReservations = (await import('../services/api.js')).fetchReservations
      
      mockUpdateClient.mockRejectedValue(new Error('Network error'))
      mockFetchClients.mockResolvedValue([{ id: 1, firstName: 'Jane', lastName: 'Doe' }])
      mockFetchReservations.mockResolvedValue([])

      await expect(
        updateClientOnServer(1, { firstName: 'John' }, mockSetClients, mockSetReservations)
      ).rejects.toThrow('Network error')

      expect(mockFetchClients).toHaveBeenCalled()
      expect(mockFetchReservations).toHaveBeenCalled()
      expect(global.alert).toHaveBeenCalledWith('Error de conexión. Los cambios se han revertido.')
    })
  })
}) 