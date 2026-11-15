import { describe, expect, it } from 'vitest';
import {
  buildCheckInPanelItems,
  buildReceptionDashboardModel,
  isRoomOutOfService,
  lateCheckoutItems,
  occupancyByRoomType,
  pendingCheckoutItems,
  physicalInServiceRooms
} from './receptionDashboardStats';

const rooms = [
  { id: 1, name: '1', maxPeople: 2, status: 'available', roomType: { name: 'Doble' } },
  { id: 2, name: '2', maxPeople: 2, status: 'maintenance', roomType: { name: 'Doble' } },
  { id: 3, name: '3', maxPeople: 4, status: 'available', roomType: { name: 'Familiar' } }
];

describe('receptionDashboardStats', () => {
  it('excluye fuera de servicio de la capacidad', () => {
    expect(isRoomOutOfService(rooms[1])).toBe(true);
    expect(physicalInServiceRooms(rooms)).toHaveLength(2);
  });

  it('detecta checkouts atrasados solo si siguen INGRESADA', () => {
    const reservations = [
      {
        id: 10,
        status: 'INGRESADA',
        mainClient: { firstName: 'Ana', lastName: 'Ruiz' },
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 2,
            isActive: true
          }
        ]
      },
      {
        id: 11,
        status: 'FINALIZADA',
        mainClient: { firstName: 'Luis', lastName: 'Mora' },
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            guestCount: 2,
            isActive: true
          }
        ]
      }
    ];

    const late = lateCheckoutItems('2024-01-05', rooms, reservations);
    expect(late).toHaveLength(1);
    expect(late[0].reservationId).toBe(10);
  });

  it('ocupacion por tipo usa solo habitaciones en servicio', () => {
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
      }
    ];
    const byType = occupancyByRoomType('2024-01-02', rooms, reservations);
    const doble = byType.find((r) => r.typeName === 'Doble');
    const familiar = byType.find((r) => r.typeName === 'Familiar');
    expect(doble.total).toBe(1);
    expect(doble.occupied).toBe(1);
    expect(familiar.total).toBe(1);
    expect(familiar.occupied).toBe(0);
  });

  it('ingresos incluyen hoy y anteriores aún no ingresadas', () => {
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
        status: 'PENDIENTE',
        requiredGuests: 1,
        mainClient: { firstName: 'Luis', lastName: 'Mora' },
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-03',
            guestCount: 1,
            isActive: true
          }
        ]
      }
    ];
    const items = buildCheckInPanelItems('2024-01-02', rooms, reservations);
    expect(items.map((i) => i.reservationId).sort()).toEqual([1, 2]);
    expect(items.find((i) => i.reservationId === 2).overdue).toBe(true);
  });

  it('egresos lista todas las INGRESADA pendientes de finalizar', () => {
    const reservations = [
      {
        id: 10,
        status: 'INGRESADA',
        mainClient: { firstName: 'Ana', lastName: 'Ruiz' },
        segments: [
          {
            roomId: 1,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            guestCount: 2,
            isActive: true
          }
        ]
      },
      {
        id: 11,
        status: 'INGRESADA',
        mainClient: { firstName: 'Luis', lastName: 'Mora' },
        segments: [
          {
            roomId: 3,
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            guestCount: 2,
            isActive: true
          }
        ]
      }
    ];
    const items = pendingCheckoutItems('2024-01-05', rooms, reservations);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.reservationId === 11).late).toBe(true);
    expect(items.find((i) => i.reservationId === 10).late).toBe(false);
  });

  it('buildReceptionDashboardModel arma ingresos y mañana', () => {
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
      }
    ];
    const model = buildReceptionDashboardModel({
      todayIso: '2024-01-02',
      rooms,
      reservations,
      serviceTypes: []
    });
    expect(model.today.checkIns).toBe(2);
    expect(model.capacityRoomsCount).toBe(2);
    expect(model.tomorrowIso).toBe('2024-01-03');
    expect(model.notifications.some((n) => n.kind === 'PENDING_ARRIVAL')).toBe(true);
  });
});
