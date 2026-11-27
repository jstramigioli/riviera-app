/**
 * syncLodgingChargesAndNightRates: el borrado de cargos/tarifas viejos y la recreación van juntos
 * en una transacción, después de calcular todo. Un error de cálculo no debe dejar la cuenta sin
 * cargos de alojamiento.
 */
const mockTx = {
  cargo: { deleteMany: jest.fn(), create: jest.fn() },
  reservationNightRate: { deleteMany: jest.fn(), create: jest.fn() }
};
const mockPrisma = {
  serviceType: { findUnique: jest.fn() },
  hotel: { findFirst: jest.fn().mockResolvedValue({ id: 'h1' }) },
  cargo: { deleteMany: jest.fn(), create: jest.fn() },
  reservationNightRate: { deleteMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockTx))
};
jest.mock('../../src/utils/prisma', () => mockPrisma);
jest.mock('../../src/utils/accountHelpers', () => ({
  ensureReservationAccount: jest.fn().mockResolvedValue({ id: 3, kind: 'RESERVATION' }),
  dualWriteReservationRefs: jest.fn(() => ({ accountId: 3, reservaId: 10 }))
}));
jest.mock('../../src/utils/promotionEngine', () => ({
  loadActivePromotionRules: jest.fn().mockResolvedValue([]),
  evaluateRateRules: jest.fn(),
  computeHotelOccupancyPercent: jest.fn()
}));
jest.mock('../../src/utils/prestacionesComida', () => ({
  safeSyncPrestacionesComida: jest.fn()
}));

const { syncLodgingChargesAndNightRates } = require('../../src/utils/reservationHelpers');

const segment = {
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  roomId: 5,
  roomTypeId: 2,
  services: ['con_desayuno'],
  baseRate: 1000,
  room: { name: '101' }
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((cb) => cb(mockTx));
});

test('si falla el cálculo no se borra ningún cargo existente', async () => {
  mockPrisma.serviceType.findUnique.mockRejectedValue(new Error('db caída'));
  await expect(syncLodgingChargesAndNightRates(10, [segment], [])).rejects.toThrow('db caída');
  expect(mockPrisma.cargo.deleteMany).not.toHaveBeenCalled();
  expect(mockTx.cargo.deleteMany).not.toHaveBeenCalled();
  expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

test('borra y recrea dentro de la transacción (una fila por noche)', async () => {
  mockPrisma.serviceType.findUnique.mockResolvedValue({ name: 'Con desayuno', hotelId: 'h1' });
  const quoted = [
    { date: '2026-12-01', finalRate: 1000, baseRate: 1000 },
    { date: '2026-12-02', finalRate: 1200, baseRate: 1200 }
  ];
  const { totalNights } = await syncLodgingChargesAndNightRates(10, [segment], [{ nightRates: quoted }]);

  expect(totalNights).toBe(2);
  expect(mockPrisma.cargo.deleteMany).not.toHaveBeenCalled();
  expect(mockTx.cargo.deleteMany).toHaveBeenCalledTimes(1);
  expect(mockTx.reservationNightRate.deleteMany).toHaveBeenCalledTimes(1);
  expect(mockTx.cargo.create).toHaveBeenCalledTimes(2);
  expect(mockTx.reservationNightRate.create).toHaveBeenCalledTimes(2);
  expect(mockTx.cargo.create.mock.calls.map((c) => c[0].data.monto)).toEqual([1000, 1200]);
});
