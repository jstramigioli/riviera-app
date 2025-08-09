import { describe, it, expect, vi } from 'vitest'
import { 
  validateReservationConflict, 
  showConflictNotification, 
  validateReservationDates
} from './reservationUtils'

describe('reservationUtils', () => {
  describe('validateReservationConflict', () => {
    it('detects no conflict for empty reservations', () => {
      const reservations = []
      const result = validateReservationConflict(reservations, 1, '2024-01-01', '2024-01-05')
      
      expect(result.hasConflict).toBe(false)
    })

    it('detects conflict with existing reservation', () => {
      const reservations = [
        {
          id: 1,
          roomId: 1,
          checkIn: '2024-01-03',
          checkOut: '2024-01-07',
          mainClient: { firstName: 'John', lastName: 'Doe' }
        }
      ]
      const result = validateReservationConflict(reservations, 1, '2024-01-01', '2024-01-05')
      
      expect(result.hasConflict).toBe(true)
      expect(result.conflictingReservation).toEqual(reservations[0])
      expect(result.message).toContain('Conflicto con reserva existente')
    })

    it('excludes current reservation from conflict check', () => {
      const reservations = [
        {
          id: 1,
          roomId: 1,
          checkIn: '2024-01-03',
          checkOut: '2024-01-07',
          mainClient: { firstName: 'John', lastName: 'Doe' }
        }
      ]
      const result = validateReservationConflict(reservations, 1, '2024-01-03', '2024-01-07', 1)
      
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('showConflictNotification', () => {
    it('shows conflict notification with position', () => {
      const message = 'Test conflict message'
      const position = { x: 100, y: 200 }
      const result = showConflictNotification(message, position)
      
      expect(result).toEqual({
        message,
        type: 'error',
        position
      })
    })

    it('shows alert when no position provided', () => {
      const message = 'Test conflict message'
      global.alert = vi.fn()
      
      showConflictNotification(message)
      
      expect(global.alert).toHaveBeenCalledWith('⚠️ Conflicto de reserva: Test conflict message')
    })
  })

  describe('validateReservationDates', () => {
    it('validates correct dates', () => {
      const checkIn = '2024-01-01'
      const checkOut = '2024-01-05'
      const result = validateReservationDates(checkIn, checkOut)
      
      expect(result.isValid).toBe(true)
    })

    it('detects check-out before check-in', () => {
      const checkIn = '2024-01-05'
      const checkOut = '2024-01-01'
      const result = validateReservationDates(checkIn, checkOut)
      
      expect(result.isValid).toBe(false)
      expect(result.message).toBe('La fecha de check-out debe ser posterior a la fecha de check-in')
    })

    it('validates same day check-in and check-out', () => {
      const checkIn = '2024-01-01'
      const checkOut = '2024-01-01'
      const result = validateReservationDates(checkIn, checkOut)
      
      expect(result.isValid).toBe(false)
      expect(result.message).toBe('La fecha de check-out debe ser posterior a la fecha de check-in')
    })
  })
}) 