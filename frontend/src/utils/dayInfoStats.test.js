import { describe, expect, it } from 'vitest';
import { computeDayInfoStats, guestsForCoveringSegments } from './dayInfoStats';

// Desayunos y cenas se calculan en el backend (PrestacionComida):
// ver backend/tests/utils/prestacionesComida.test.js.

const rooms = [
  { id: 1, name: '1', maxPeople: 2 },
  { id: 2, name: '2', maxPeople: 2 },
  { id: 3, name: '3', maxPeople: 4 }
]; // capacidad total = 8

describe('computeDayInfoStats', () => {
  it('ocupacion de pasajeros usa Σ maxPeople, no cantidad de habitaciones', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 3,
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 3,
            isActive: true
          }
        ]
      }
    ];

    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);

    expect(stats.totalGuests).toBe(3);
    expect(stats.totalGuestCapacity).toBe(8);
    expect(stats.occupiedRooms).toBe(1);
    expect(stats.roomOccupancyPercentage).toBeCloseTo((1 / 3) * 100, 5);
    // Antes: 3/3*100 = 100% (mal). Correcto: 3/8*100 = 37.5%
    expect(stats.guestOccupancyPercentage).toBeCloseTo(37.5, 5);
  });

  it('cuenta check-in/out en pasajeros del grupo, no en segmentos', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 2,
        mainClient: { firstName: 'Ana', lastName: 'Ruiz' },
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-02',
            endDate: '2024-01-04',
            guestCount: 2,
            isActive: true
          }
        ]
      },
      {
        id: 2,
        status: 'CONFIRMADA',
        requiredGuests: 4,
        mainClient: { firstName: 'Luis', lastName: 'Mora' },
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            guestCount: 4,
            isActive: true
          }
        ]
      }
    ];

    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.checkIns).toBe(2);
    expect(stats.checkOuts).toBe(4);
    expect(stats.checkInNames).toEqual(['1 - Ana Ruiz']);
    expect(stats.checkOutNames).toEqual(['3 - Luis Mora']);
    expect(stats.checkInItems).toEqual([
      {
        reservationId: 1,
        roomLabel: '1',
        guestName: 'Ana Ruiz',
        label: '1 - Ana Ruiz'
      }
    ]);
    expect(stats.checkOutItems).toEqual([
      {
        reservationId: 2,
        roomLabel: '3',
        guestName: 'Luis Mora',
        label: '3 - Luis Mora'
      }
    ]);
    expect(stats.totalGuests).toBe(2);
    expect(stats.occupiedRooms).toBe(1);
  });

  it('ignora canceladas y no presentadas', () => {
    const reservations = [
      {
        id: 1,
        status: 'CANCELADA',
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 2,
            isActive: true
          }
        ]
      },
      {
        id: 2,
        status: 'NO_PRESENTADA',
        segments: [
          {
            roomId: 2,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 2,
            isActive: true
          }
        ]
      }
    ];

    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.occupiedRooms).toBe(0);
    expect(stats.totalGuests).toBe(0);
    expect(stats.guestOccupancyPercentage).toBe(0);
  });

  it('no doble-cuenta huéspedes de habitación virtual', () => {
    const covering = [
      { roomId: 1, virtualRoomId: 10, guestCount: 3 },
      { roomId: 2, virtualRoomId: 10, guestCount: 1 }
    ];
    expect(guestsForCoveringSegments({ requiredGuests: 3 }, covering)).toBe(3);

    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 3,
        segments: [
          {
            roomId: 1,
            virtualRoomId: 10,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 3,
            isActive: true
          },
          {
            roomId: 2,
            virtualRoomId: 10,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 1,
            isActive: true
          }
        ]
      }
    ];

    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.occupiedRooms).toBe(2);
    expect(stats.totalGuests).toBe(3);
    expect(stats.guestOccupancyPercentage).toBeCloseTo((3 / 8) * 100, 5);
  });

  it('legacy sin segmentos usa requiredGuests', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        roomId: 1,
        requiredGuests: 2
      }
    ];
    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.totalGuests).toBe(2);
    expect(stats.guestOccupancyPercentage).toBeCloseTo(25, 5);
  });

  it('pasajeros con check-in, check-out y estadía en curso el mismo día', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 2,
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-02',
            endDate: '2024-01-04',
            guestCount: 2,
            services: ['media_pension'],
            isActive: true
          }
        ]
      },
      {
        id: 2,
        status: 'CONFIRMADA',
        requiredGuests: 3,
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            guestCount: 3,
            services: ['media_pension'],
            isActive: true
          }
        ]
      },
      {
        id: 3,
        status: 'CONFIRMADA',
        requiredGuests: 4,
        segments: [
          {
            roomId: 2,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            guestCount: 4,
            services: ['media_pension'],
            isActive: true
          }
        ]
      }
    ];

    // Día 2: check-in #1 (2), check-out #2 (3), middle #3 (4)
    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.totalGuests).toBe(6); // noche: check-in 2 + middle 4
    expect(stats.occupiedRooms).toBe(2);
  });

  it('pasajeros por día de una estadía (check-out no suma noche)', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 2,
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 2,
            services: ['media_pension'],
            isActive: true
          }
        ]
      }
    ];

    const checkInDay = computeDayInfoStats('2024-01-01', rooms, reservations);
    expect(checkInDay.totalGuests).toBe(2);

    const middleDay = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(middleDay.totalGuests).toBe(2);

    const checkOutDay = computeDayInfoStats('2024-01-03', rooms, reservations);
    expect(checkOutDay.totalGuests).toBe(0);
    expect(checkOutDay.occupiedRooms).toBe(0);
  });

  it('suma pasajeros de reservas con distintos servicios', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        requiredGuests: 2,
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 2,
            services: ['con_desayuno'],
            isActive: true
          }
        ]
      },
      {
        id: 2,
        status: 'CONFIRMADA',
        requiredGuests: 3,
        segments: [
          {
            roomId: 2,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 3,
            services: ['solo_alojamiento'],
            isActive: true
          }
        ]
      },
      {
        id: 3,
        status: 'CONFIRMADA',
        requiredGuests: 4,
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 4,
            services: ['media_pension'],
            isActive: true
          }
        ]
      }
    ];

    const middle = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(middle.totalGuests).toBe(9);
    expect(middle).not.toHaveProperty('breakfastGuests');
  });
});
