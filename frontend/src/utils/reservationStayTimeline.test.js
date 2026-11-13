import { describe, expect, it } from 'vitest';
import { buildReservationStayTimeline } from './reservationStayTimeline';

const serviceLabel = (id) => {
  const map = {
    breakfast: 'Desayuno',
    half: 'Media pensión',
    base: 'Alojamiento'
  };
  return map[id] || id;
};

describe('buildReservationStayTimeline', () => {
  it('arma check-in / check-out con card solo en la estadía y header (sin creación)', () => {
    const timeline = buildReservationStayTimeline(
      {
        createdAt: '2026-11-01T12:00:00.000Z',
        checkIn: '2026-11-10',
        checkOut: '2026-11-14',
        totalAmount: 400,
        requiredGuests: 2,
        mainClient: { id: 9, firstName: 'Ana', lastName: 'Pérez' },
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-14',
            roomId: 22,
            room: { name: '22', roomType: { name: 'Doble' } },
            services: ['breakfast'],
            baseRate: 100,
            guestCount: 2,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    const nodes = timeline.items.filter((i) => i.type === 'node');
    const edges = timeline.items.filter((i) => i.type === 'edge');
    const stay = edges.find((e) => e.id === 'edge-stay');

    expect(nodes.map((n) => n.title)).toEqual(['Check-in', 'Check-out']);
    expect(timeline.items.find((i) => i.id === 'creation')).toBeUndefined();
    expect(timeline.items.find((i) => i.id === 'edge-pre-checkin')).toBeUndefined();
    expect(edges).toHaveLength(1);
    expect(stay.label).toBe('22 · desayuno');
    expect(stay.card).toEqual({
      room: '22',
      roomType: 'Doble',
      service: 'Desayuno',
      guests: 2,
      nights: 4
    });
    expect(timeline.header).toEqual({
      clientName: 'Ana Pérez',
      clientId: 9,
      totalNights: 4,
      totalAmount: 400
    });
    expect(timeline.isMultiSegment).toBe(false);
  });

  it('inserta nodos de cambio de habitación y servicio en multi-tramo', () => {
    const timeline = buildReservationStayTimeline(
      {
        createdAt: '2026-11-01T12:00:00.000Z',
        checkIn: '2026-11-10',
        checkOut: '2026-11-16',
        mainClient: { firstName: 'Luis', lastName: 'Gómez' },
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            roomId: 22,
            room: { name: '22', roomType: { name: 'Doble' } },
            services: ['breakfast'],
            baseRate: 100,
            guestCount: 2,
            isActive: true
          },
          {
            id: 2,
            startDate: '2026-11-12',
            endDate: '2026-11-14',
            roomId: 15,
            room: { name: '15', roomType: { name: 'Triple' } },
            services: ['breakfast'],
            baseRate: 100,
            guestCount: 2,
            isActive: true
          },
          {
            id: 3,
            startDate: '2026-11-14',
            endDate: '2026-11-16',
            roomId: 15,
            room: { name: '15', roomType: { name: 'Triple' } },
            services: ['half'],
            baseRate: 130,
            guestCount: 3,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    const nodes = timeline.items.filter((i) => i.type === 'node');
    const edges = timeline.items.filter((i) => i.type === 'edge');

    expect(nodes.map((n) => n.title)).toEqual([
      'Check-in',
      'Cambio de habitación',
      'Cambio de servicio',
      'Check-out'
    ]);
    expect(edges.map((e) => e.label)).toEqual([
      '22 · desayuno',
      '15 · desayuno',
      '15 · media pensión'
    ]);
    expect(edges[0].card).toMatchObject({
      room: '22',
      roomType: 'Doble',
      service: 'Desayuno',
      guests: 2,
      nights: 2
    });
    expect(edges[1].card).toMatchObject({
      room: '15',
      roomType: 'Triple',
      service: 'Desayuno',
      guests: 2,
      nights: 2
    });
    expect(edges[2].card).toMatchObject({
      room: '15',
      roomType: 'Triple',
      service: 'Media pensión',
      guests: 3,
      nights: 2
    });
    expect(timeline.header.clientName).toBe('Luis Gómez');
    expect(timeline.header.totalNights).toBe(6);
    expect(timeline.header.totalAmount).toBe(100 * 2 + 100 * 2 + 130 * 2);
    expect(timeline.isMultiSegment).toBe(true);
  });

  it('colapsa componentes virtuales al mismo rango', () => {
    const timeline = buildReservationStayTimeline(
      {
        createdAt: '2026-11-01T12:00:00.000Z',
        checkIn: '2026-11-10',
        checkOut: '2026-11-12',
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            roomId: 8,
            room: { name: '8' },
            virtualRoomId: 2,
            virtualRoom: { name: '8-9 (cuadruple)', roomType: { name: 'Cuádruple' } },
            services: ['breakfast'],
            baseRate: 200,
            guestCount: 4,
            isActive: true
          },
          {
            id: 2,
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            roomId: 9,
            room: { name: '9' },
            virtualRoomId: 2,
            virtualRoom: { name: '8-9 (cuadruple)', roomType: { name: 'Cuádruple' } },
            services: ['breakfast'],
            baseRate: 0,
            guestCount: 1,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    expect(timeline.segments).toHaveLength(1);
    const stayEdge = timeline.items.find((i) => i.id === 'edge-stay');
    expect(stayEdge.label).toBe('8-9 (cuadruple) · desayuno');
    expect(stayEdge.card).toMatchObject({
      room: '8-9 (cuadruple)',
      roomType: 'Cuádruple',
      service: 'Desayuno',
      guests: 4,
      nights: 2
    });
    expect(timeline.isMultiSegment).toBe(false);
  });
});
