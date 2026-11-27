/**
 * Editar estadía: si falla la regeneración de cargos de alojamiento, la estadía se guarda pero
 * la respuesta trae un aviso (antes el error quedaba solo en el log del servidor).
 */
const segmentRow = {
  id: 1,
  reservationId: 10,
  startDate: new Date('2026-12-01T00:00:00Z'),
  endDate: new Date('2026-12-03T00:00:00Z'),
  roomId: 5,
  roomTypeId: 2,
  services: ['con_desayuno'],
  baseRate: 1000,
  room: { name: '101' }
};
const mockTx = {
  reservation: { update: jest.fn().mockResolvedValue({ id: 10 }) },
  account: { updateMany: jest.fn() },
  reservationSegment: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn(),
    create: jest.fn().mockResolvedValue(segmentRow)
  },
  room: { findUnique: jest.fn() }
};
const mockPrisma = {
  $transaction: jest.fn((cb) => cb(mockTx)),
  serviceType: { findUnique: jest.fn().mockRejectedValue(new Error('tarifas no disponibles')) },
  hotel: { findFirst: jest.fn() },
  cargo: { count: jest.fn().mockResolvedValue(0) },
  reservationNightRate: { count: jest.fn().mockResolvedValue(0) },
  reservation: { findUnique: jest.fn().mockResolvedValue(null) }
};
jest.mock('../../src/utils/prisma', () => mockPrisma);
jest.mock('../../src/utils/accountHelpers', () => ({
  ensureReservationAccount: jest.fn().mockResolvedValue({ id: 3 }),
  dualWriteReservationRefs: jest.fn(() => ({ accountId: 3, reservaId: 10 }))
}));
jest.mock('../../src/utils/promotionEngine', () => ({
  loadActivePromotionRules: jest.fn().mockResolvedValue([]),
  evaluateRateRules: jest.fn(),
  computeHotelOccupancyPercent: jest.fn()
}));
jest.mock('../../src/utils/prestacionesComida', () => ({ safeSyncPrestacionesComida: jest.fn() }));
jest.mock('../../src/utils/virtualRoomSegments', () => ({
  expandVirtualRoomSegments: jest.fn(async (s) => s),
  isVirtualBlockingSegment: jest.fn(() => false),
  collapseVirtualGroupsForTimeline: jest.fn((s) => s)
}));

const { updateReservationWithSegments } = require('../../src/utils/reservationHelpers');

test('devuelve aviso LODGING_SYNC_FAILED si no se pudieron recalcular los cargos', async () => {
  const result = await updateReservationWithSegments(10, {
    segments: [{ roomId: 5, roomTypeId: 2, startDate: '2026-12-01', endDate: '2026-12-03', services: ['con_desayuno'], baseRate: 1000, guestCount: 2 }]
  });
  expect(mockTx.reservationSegment.create).toHaveBeenCalled();
  expect(result.warnings).toEqual([expect.objectContaining({ code: 'LODGING_SYNC_FAILED' })]);
});

test('sin cambios de estadía no hay avisos', async () => {
  const result = await updateReservationWithSegments(10, { notes: 'hola' });
  expect(result?.warnings).toBeUndefined();
});
