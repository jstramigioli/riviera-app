import { describe, expect, it } from 'vitest';
import { computeDayInfoStats, guestsForCoveringSegments } from './dayInfoStats';

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
    expect(stats.checkInNames).toEqual(['Ana Ruiz']);
    expect(stats.checkOutNames).toEqual(['Luis Mora']);
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

  it('desayuno/cena: check-in no desayuna y sí cena; check-out al revés', () => {
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
            isActive: true
          }
        ]
      }
    ];

    // Día 2: check-in #1 (2), check-out #2 (3), middle #3 (4)
    const stats = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(stats.totalGuests).toBe(6); // noche: check-in 2 + middle 4
    expect(stats.occupiedRooms).toBe(2);
    expect(stats.dinnerGuests).toBe(6); // = pasajeros noche
    expect(stats.breakfastGuests).toBe(7); // check-out 3 + middle 4 (sin check-in)
  });

  it('desayuno en día medio y cena nula el día de check-out', () => {
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
            isActive: true
          }
        ]
      }
    ];

    const checkInDay = computeDayInfoStats('2024-01-01', rooms, reservations);
    expect(checkInDay.breakfastGuests).toBe(0);
    expect(checkInDay.dinnerGuests).toBe(2);
    expect(checkInDay.totalGuests).toBe(2);

    const middleDay = computeDayInfoStats('2024-01-02', rooms, reservations);
    expect(middleDay.breakfastGuests).toBe(2);
    expect(middleDay.dinnerGuests).toBe(2);

    const checkOutDay = computeDayInfoStats('2024-01-03', rooms, reservations);
    expect(checkOutDay.breakfastGuests).toBe(2);
    expect(checkOutDay.dinnerGuests).toBe(0);
    expect(checkOutDay.totalGuests).toBe(0);
    expect(checkOutDay.occupiedRooms).toBe(0);
  });
});
