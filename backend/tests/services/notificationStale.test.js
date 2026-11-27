/**
 * Las notificaciones SYSTEM de ingreso/checkout atrasado que ya no se cumplen se resuelven solas
 * (antes quedaban abiertas para siempre, p. ej. «Checkout atrasado» con fecha futura).
 */
const mockPrisma = {
  reservation: { findMany: jest.fn() },
  appNotification: { findMany: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() }
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

const {
  staleOperationalIds,
  syncOperationalNotifications
} = require('../../src/services/notificationSync');

const TODAY = '2026-11-26';

function reserva(id, status, start, end) {
  return {
    id,
    status,
    mainClient: { firstName: 'Ana', lastName: 'Paz' },
    guests: [],
    segments: [{ isActive: true, startDate: `${start}T00:00:00.000Z`, endDate: `${end}T00:00:00.000Z` }]
  };
}

beforeEach(() => jest.clearAllMocks());

test('staleOperationalIds: solo las que ya no están vigentes', () => {
  const open = [
    { id: 1, dedupeKey: 'LATE_CHECKOUT:7' },
    { id: 2, dedupeKey: 'PENDING_ARRIVAL:8' },
    { id: 3, dedupeKey: null }
  ];
  expect(staleOperationalIds(open, new Set(['PENDING_ARRIVAL:8']))).toEqual([1, 3]);
});

test('resuelve checkout atrasado con fecha futura y conserva el atrasado real', async () => {
  mockPrisma.reservation.findMany.mockImplementation(({ where }) => {
    if (where.status === 'INGRESADA') return Promise.resolve([]); // cumpleaños
    return Promise.resolve([
      reserva(7, 'INGRESADA', '2026-12-01', '2026-12-09'), // checkout futuro: no atrasado
      reserva(8, 'CONFIRMADA', '2026-11-21', '2026-11-30') // ingreso realmente atrasado
    ]);
  });
  mockPrisma.appNotification.findMany.mockImplementation(({ where }) => {
    if (where.type === 'GUEST_BIRTHDAY') return Promise.resolve([]);
    return Promise.resolve([
      { id: 11, dedupeKey: 'LATE_CHECKOUT:7' },
      { id: 12, dedupeKey: 'PENDING_ARRIVAL:8' },
      { id: 13, dedupeKey: 'LATE_CHECKOUT:99' } // reserva ya finalizada / inexistente
    ]);
  });
  mockPrisma.appNotification.updateMany.mockResolvedValue({ count: 2 });

  const result = await syncOperationalNotifications(TODAY);

  expect(mockPrisma.appNotification.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: [11, 13] } } })
  );
  expect(mockPrisma.appNotification.upsert).not.toHaveBeenCalled();
  expect(result.autoResolved).toBe(2);
});
