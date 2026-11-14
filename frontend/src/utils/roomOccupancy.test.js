import { describe, expect, it } from 'vitest'
import {
  occupancyLabel,
  reservationTouchesRoom,
  stayBoundsForRoom,
} from './roomOccupancy'

describe('roomOccupancy', () => {
  const reservation = {
    id: 1,
    status: 'CONFIRMADA',
    segments: [
      { roomId: 5, startDate: '2026-11-20', endDate: '2026-11-25' },
      { roomId: 7, startDate: '2026-11-20', endDate: '2026-11-22' },
    ],
  }

  it('detects reservations that touch a room', () => {
    expect(reservationTouchesRoom(reservation, 5)).toBe(true)
    expect(reservationTouchesRoom(reservation, 9)).toBe(false)
  })

  it('computes stay bounds for a room', () => {
    const { start, end } = stayBoundsForRoom(reservation, 5)
    expect(start.toISOString().slice(0, 10)).toBe('2026-11-20')
    expect(end.toISOString().slice(0, 10)).toBe('2026-11-25')
  })

  it('labels occupancy from active stays', () => {
    const now = new Date('2026-11-21T12:00:00')
    expect(occupancyLabel(5, [reservation], now)).toBe('Ocupada')
    expect(occupancyLabel(5, [{ ...reservation, status: 'CANCELADA' }], now)).toBe('Disponible')
  })
})
