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
  it('arma creación / check-in / check-out con etiqueta solo en la estadía', () => {
    const timeline = buildReservationStayTimeline(
      {
        createdAt: '2026-11-01T12:00:00.000Z',
        checkIn: '2026-11-10',
        checkOut: '2026-11-14',
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-14',
            roomId: 22,
            room: { name: '22' },
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
    const pre = edges.find((e) => e.id === 'edge-pre-checkin');
    const stay = edges.find((e) => e.id === 'edge-stay');

    expect(nodes.map((n) => n.title)).toEqual(['Creación', 'Check-in', 'Check-out']);
    expect(edges).toHaveLength(2);
    expect(pre).toMatchObject({ compact: true, label: null });
    expect(stay.label).toBe('22 · desayuno');
    expect(timeline.isMultiSegment).toBe(false);
  });

  it('inserta nodos de cambio de habitación y servicio en multi-tramo', () => {
    const timeline = buildReservationStayTimeline(
      {
        createdAt: '2026-11-01T12:00:00.000Z',
        checkIn: '2026-11-10',
        checkOut: '2026-11-16',
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            roomId: 22,
            room: { name: '22' },
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
            room: { name: '15' },
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
            room: { name: '15' },
            services: ['half'],
            baseRate: 130,
            guestCount: 2,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    const nodes = timeline.items.filter((i) => i.type === 'node');
    const edges = timeline.items.filter((i) => i.type === 'edge');

    expect(nodes.map((n) => n.title)).toEqual([
      'Creación',
      'Check-in',
      'Cambio de habitación',
      'Cambio de servicio',
      'Check-out'
    ]);
    expect(edges.map((e) => e.label)).toEqual([
      null,
      '22 · desayuno',
      '15 · desayuno',
      '15 · media pensión'
    ]);
    expect(edges[0]).toMatchObject({ id: 'edge-pre-checkin', compact: true });
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
            virtualRoom: { name: '8-9 (cuadruple)' },
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
            virtualRoom: { name: '8-9 (cuadruple)' },
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
    expect(timeline.items.find((i) => i.id === 'edge-pre-checkin').label).toBeNull();
    expect(timeline.isMultiSegment).toBe(false);
  });
});
