import { describe, it, expect } from 'vitest';
import { collectReservationPanelRequirements } from './reservationPanelRequirements';

const tags = [
  { id: 1, name: 'Vista al mar', color: '#3f5f8a' },
  { id: 2, name: 'Planta baja', color: '#2f9e44' }
];

describe('collectReservationPanelRequirements', () => {
  it('devuelve vacío si no hay requisitos', () => {
    const result = collectReservationPanelRequirements({
      segments: [{ roomId: 10, room: { name: '101' }, requiredTags: [] }]
    }, tags);
    expect(result.hasAny).toBe(false);
    expect(result.fixedRooms).toEqual([]);
    expect(result.selectedTags).toEqual([]);
  });

  it('incluye habitación fijada por requiredRoomId', () => {
    const result = collectReservationPanelRequirements({
      segments: [{
        roomId: 10,
        requiredRoomId: 10,
        room: { name: 'Habitación 12' },
        requiredTags: []
      }]
    }, tags);
    expect(result.hasAny).toBe(true);
    expect(result.fixedRooms).toEqual([{ key: 'req:10', name: '12' }]);
  });

  it('incluye habitación fijada por fixed sin requiredRoomId', () => {
    const result = collectReservationPanelRequirements({
      segments: [{
        roomId: 7,
        fixed: true,
        room: { name: '5' },
        requiredTags: []
      }]
    }, tags);
    expect(result.fixedRooms).toEqual([{ key: 'room:7', name: '5' }]);
  });

  it('resuelve tags por id (number o string)', () => {
    const result = collectReservationPanelRequirements({
      segments: [{
        roomId: 1,
        room: { name: '1' },
        requiredTags: [1, '2']
      }]
    }, tags);
    expect(result.selectedTags.map((t) => t.name)).toEqual(['Vista al mar', 'Planta baja']);
  });

  it('dedupe rooms y tags entre segmentos; ignora inactivos si hay activos', () => {
    const result = collectReservationPanelRequirements({
      segments: [
        {
          isActive: true,
          roomId: 10,
          requiredRoomId: 10,
          room: { name: '12' },
          requiredTags: [1]
        },
        {
          isActive: true,
          roomId: 10,
          requiredRoomId: 10,
          room: { name: '12' },
          requiredTags: [1, 2]
        },
        {
          isActive: false,
          roomId: 99,
          requiredRoomId: 99,
          room: { name: '99' },
          requiredTags: [2]
        }
      ]
    }, tags);
    expect(result.fixedRooms).toHaveLength(1);
    expect(result.selectedTags.map((t) => t.id)).toEqual([1, 2]);
  });
});
