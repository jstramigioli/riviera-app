import { describe, it, expect } from 'vitest'
import {
  roomsMatch,
  findMatchingRoom,
  preserveSelectedRoomInList,
  selectedRoomFromCollapsedSegment,
  collapseSegmentsForEditUi
} from './virtualRoomReservation'

describe('virtualRoomReservation room selection', () => {
  it('roomsMatch compara ids numéricos y string', () => {
    expect(roomsMatch({ id: 5 }, { id: '5' })).toBe(true)
    expect(roomsMatch({ id: 5 }, { id: 6 })).toBe(false)
  })

  it('roomsMatch compara virtuales por virtualRoomId', () => {
    expect(
      roomsMatch(
        { id: 'virtual_3', isVirtual: true, virtualRoomId: 3 },
        { id: 'virtual_3', isVirtual: true, virtualRoomId: '3' }
      )
    ).toBe(true)
    expect(
      roomsMatch(
        { id: 'virtual_3', isVirtual: true, virtualRoomId: 3 },
        { id: 3 }
      )
    ).toBe(false)
  })

  it('preserveSelectedRoomInList rebind a la del listado con tarifas nuevas', () => {
    const selected = { id: 10, name: 'Hab 10', price: 100 }
    const rooms = [
      { id: 2, name: 'Hab 2', price: 200 },
      { id: '10', name: 'Hab 10', price: 250 }
    ]
    const result = preserveSelectedRoomInList(rooms, selected)
    expect(result.selected.price).toBe(250)
    expect(result.rooms).toHaveLength(2)
  })

  it('preserveSelectedRoomInList antepone la seleccionada si no viene en el listado', () => {
    const selected = { id: 99, name: 'Hab 99', price: 100 }
    const rooms = [{ id: 1, name: 'Hab 1', price: 50 }]
    const result = preserveSelectedRoomInList(rooms, selected)
    expect(result.rooms[0].id).toBe(99)
    expect(result.selected).toEqual(selected)
  })

  it('findMatchingRoom devuelve null sin selección', () => {
    expect(findMatchingRoom([{ id: 1 }], null)).toBe(null)
  })

  it('selectedRoomFromCollapsedSegment conserva habitación física del segmento', () => {
    const seg = {
      roomId: 7,
      guestCount: 2,
      baseRate: 1200,
      room: { name: 'Suite Lago', maxPeople: 2, roomType: { id: 1, name: 'Suite' } }
    }
    const room = selectedRoomFromCollapsedSegment(seg)
    expect(room.id).toBe(7)
    expect(room.name).toBe('Suite Lago')
  })

  it('collapse + selectedRoom prefills virtual primaria', () => {
    const collapsed = collapseSegmentsForEditUi([
      {
        roomId: 1,
        virtualRoomId: 4,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        guestCount: 3,
        baseRate: 5000,
        isActive: true,
        virtualRoom: { name: 'Duplex Norte', maxPeople: 4, roomType: { id: 2 } }
      },
      {
        roomId: 2,
        virtualRoomId: 4,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        guestCount: 1,
        baseRate: 0,
        isActive: true,
        virtualRoom: { name: 'Duplex Norte', maxPeople: 4, roomType: { id: 2 } }
      }
    ])
    expect(collapsed).toHaveLength(1)
    const room = selectedRoomFromCollapsedSegment(collapsed[0])
    expect(room.isVirtual).toBe(true)
    expect(room.name).toBe('Duplex Norte')
    expect(room.virtualRoomId).toBe(4)
  })
})
