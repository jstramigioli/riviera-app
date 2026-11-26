/**
 * Cambios de estado y borrado de reservas (llamando al controller sin HTTP/auth).
 * - Reactivar una cancelada: solo el último grupo de tramos y solo si la habitación sigue libre.
 * - Borrar: con cobros imputados → 409 sin tocar nada; sin cobros → borrado en transacción.
 */
const mockPrisma = {
  reservation: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  reservationSegment: { findMany: jest.fn(), updateMany: jest.fn() },
  account: { findUnique: jest.fn() },
  cargo: { count: jest.fn() },
  cobro: { count: jest.fn() },
  cobroImputacion: { count: jest.fn() },
  reservationNightRate: { deleteMany: jest.fn() },
  guest: { deleteMany: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockPrisma))
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

const mockCheckRoomAvailability = jest.fn();
jest.mock('../../src/utils/reservationHelpers', () => ({
  getReservationWithData: jest.fn(),
  getAllReservationsWithData: jest.fn(),
  createReservationWithSegments: jest.fn(),
  updateReservationWithSegments: jest.fn(),
  checkRoomAvailability: (...args) => mockCheckRoomAvailability(...args)
}));
jest.mock('../../src/utils/prestacionesComida', () => ({
  safeSyncPrestacionesComida: jest.fn().mockResolvedValue(undefined)
}));
const mockValidateReservationUpdate = jest.fn();
jest.mock('../../src/utils/segmentValidation', () => ({
  validateReservationCreation: jest.fn(),
  validateReservationUpdate: (...args) => mockValidateReservationUpdate(...args)
}));

const controller = require('../../src/controllers/reservation.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

const T_EDIT = new Date('2026-11-01T10:00:00Z');
const T_CANCEL = new Date('2026-11-05T15:30:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma));
});

describe('updateReservationStatus — reactivar reserva cancelada', () => {
  beforeEach(() => {
    mockPrisma.reservation.findUnique.mockResolvedValue({ id: 10, status: 'CANCELADA' });
    mockPrisma.reservation.update.mockResolvedValue({ id: 10, status: 'CONFIRMADA' });
    mockPrisma.reservationSegment.findMany.mockResolvedValue([
      { id: 1, isActive: false, updatedAt: T_EDIT, roomId: 5, startDate: T_EDIT, endDate: T_CANCEL },
      { id: 2, isActive: false, updatedAt: T_CANCEL, roomId: 6, startDate: T_EDIT, endDate: T_CANCEL }
    ]);
  });

  test('reactiva solo los tramos del último grupo si la habitación está libre', async () => {
    mockCheckRoomAvailability.mockResolvedValue({ available: true, conflicts: [] });
    const res = mockRes();
    await controller.updateReservationStatus({ params: { id: '10' }, body: { status: 'CONFIRMADA' } }, res);

    expect(mockCheckRoomAvailability).toHaveBeenCalledTimes(1);
    expect(mockCheckRoomAvailability.mock.calls[0][0]).toBe(6);
    expect(mockPrisma.reservationSegment.updateMany).toHaveBeenCalledWith({
      where: { reservationId: 10, id: { in: [2] } },
      data: { isActive: true }
    });
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test('409 y sin cambios si la habitación ya está ocupada', async () => {
    mockCheckRoomAvailability.mockResolvedValue({
      available: false,
      conflicts: [{ reservationId: 99 }],
      blockedStatus: null
    });
    const res = mockRes();
    await controller.updateReservationStatus({ params: { id: '10' }, body: { status: 'CONFIRMADA' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'ROOM_NOT_AVAILABLE' });
    expect(res.json.mock.calls[0][0].conflicts[0].reservationIds).toEqual([99]);
    expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
    expect(mockPrisma.reservationSegment.updateMany).not.toHaveBeenCalled();
  });

  test('cancelar desactiva los tramos activos sin chequear disponibilidad', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue({ id: 10, status: 'CONFIRMADA' });
    const res = mockRes();
    await controller.updateReservationStatus({ params: { id: '10' }, body: { status: 'CANCELADA' } }, res);

    expect(mockCheckRoomAvailability).not.toHaveBeenCalled();
    expect(mockPrisma.reservationSegment.updateMany).toHaveBeenCalledWith({
      where: { reservationId: 10, isActive: true },
      data: { isActive: false }
    });
  });
});

describe('deleteReservation', () => {
  beforeEach(() => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 3 });
    mockPrisma.cargo.count.mockResolvedValue(4);
    mockPrisma.cobro.count.mockResolvedValue(1);
  });

  test('con cobros imputados responde 409 y no borra nada', async () => {
    mockPrisma.cobroImputacion.count.mockResolvedValue(2);
    const res = mockRes();
    await controller.deleteReservation({ params: { id: '10' }, query: { confirmFinancial: 'true' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('RESERVATION_HAS_COBROS');
    expect(mockPrisma.guest.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reservationNightRate.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reservation.delete).not.toHaveBeenCalled();
  });

  test('con cargos y sin confirmar pide confirmación (409)', async () => {
    mockPrisma.cobroImputacion.count.mockResolvedValue(0);
    mockPrisma.cobro.count.mockResolvedValue(0);
    const res = mockRes();
    await controller.deleteReservation({ params: { id: '10' }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('ACCOUNT_HAS_FINANCIALS');
    expect(mockPrisma.reservation.delete).not.toHaveBeenCalled();
  });

  test('confirmado y sin cobros borra todo dentro de una transacción', async () => {
    mockPrisma.cobroImputacion.count.mockResolvedValue(0);
    const res = mockRes();
    await controller.deleteReservation({ params: { id: '10' }, query: { confirmFinancial: 'true' } }, res);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.reservation.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test('si falla el borrado responde 500 (la transacción revierte huéspedes/tarifas)', async () => {
    mockPrisma.cobroImputacion.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('fk'));
    const res = mockRes();
    await controller.deleteReservation({ params: { id: '10' }, query: { confirmFinancial: 'true' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateReservation (PUT) — no cruza ocupación', () => {
  test('rechaza cancelar por PUT (debe usar PATCH /status)', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue({ id: 10, status: 'CONFIRMADA' });
    const res = mockRes();
    await controller.updateReservation({ params: { id: '10' }, body: { status: 'CANCELADA' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('STATUS_CHANGE_REQUIRES_PATCH');
  });

  test('rechaza reactivar por PUT', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue({ id: 10, status: 'CANCELADA' });
    const res = mockRes();
    await controller.updateReservation({ params: { id: '10' }, body: { status: 'CONFIRMADA' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateReservation (PUT) con estadía completa', () => {
  test('permite cambiar estado si viene segments (Consulta edición valida overlap)', async () => {
    const helpers = require('../../src/utils/reservationHelpers');
    mockValidateReservationUpdate.mockResolvedValue({ isValid: true, errors: [] });
    helpers.updateReservationWithSegments.mockResolvedValue({ id: 10, status: 'CONFIRMADA' });
    mockPrisma.reservation.findUnique.mockResolvedValue({ id: 10, status: 'CANCELADA' });
    const res = mockRes();
    await controller.updateReservation(
      { params: { id: '10' }, body: { status: 'CONFIRMADA', segments: [{ roomId: 1 }] } },
      res
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(helpers.updateReservationWithSegments).toHaveBeenCalled();
  });
});
