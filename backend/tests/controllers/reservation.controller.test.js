const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Reservas', () => {
  const segment = {
    isActive: true,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-03T00:00:00.000Z',
    roomId: 1,
    guestCount: 2,
    baseRate: 1000,
    services: ['svc-desayuno'],
    room: { id: 1, name: 'Habitación 1' }
  };

  const reservationWithSegments = (overrides = {}) => ({
    id: 1,
    mainClientId: 1,
    status: 'PENDIENTE',
    notes: null,
    isMultiRoom: false,
    parentReservationId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    mainClient: { id: 1, firstName: 'Juan', lastName: 'Pérez' },
    guests: [],
    segments: [segment],
    childReservations: [],
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

    global.mockPrisma.room.findMany.mockResolvedValue([]);
    global.mockPrisma.room.findUnique.mockResolvedValue(null);
    global.mockPrisma.client.findMany.mockResolvedValue([]);
    global.mockPrisma.client.findUnique.mockResolvedValue(null);
    global.mockPrisma.reservation.findMany.mockResolvedValue([]);
    global.mockPrisma.reservation.findUnique.mockResolvedValue(null);
    global.mockPrisma.reservation.create.mockImplementation((data) =>
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.reservation.update.mockImplementation((data) =>
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.reservation.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.reservationSegment.findMany.mockResolvedValue([]);
    global.mockPrisma.reservationSegment.create.mockImplementation((args) =>
      Promise.resolve({
        id: 1,
        isActive: true,
        ...args.data,
        room: { id: args.data?.roomId || 1 },
        roomType: null
      })
    );
  });

  describe('GET /api/reservations', () => {
    it('debería devolver todas las reservas', async () => {
      const mockReservations = [
        reservationWithSegments({ id: 1 }),
        reservationWithSegments({
          id: 2,
          mainClientId: 2,
          segments: [{
            ...segment,
            roomId: 2,
            startDate: '2024-01-05T00:00:00.000Z',
            endDate: '2024-01-07T00:00:00.000Z',
            room: { id: 2, name: 'Habitación 2' }
          }]
        })
      ];

      global.mockPrisma.reservation.findMany.mockResolvedValue(mockReservations);

      const response = await request(app)
        .get('/api/reservations')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('POST /api/reservations', () => {
    it('debería crear una nueva reserva con segmentos', async () => {
      const reservationData = {
        mainClientId: 1,
        status: 'PENDIENTE',
        segments: [{
          startDate: '2024-01-01',
          endDate: '2024-01-03',
          roomId: 1,
          guestCount: 2,
          baseRate: 1000,
          services: ['svc-desayuno']
        }]
      };

      global.mockPrisma.room.findUnique.mockResolvedValue({
        id: 1,
        name: 'Habitación 1',
        roomTypeId: 1
      });
      global.mockPrisma.serviceType.findUnique.mockResolvedValue({
        id: 'svc-desayuno',
        name: 'Con Desayuno'
      });
      global.mockPrisma.reservation.create.mockResolvedValue({
        id: 1,
        mainClientId: 1,
        status: 'active'
      });
      global.mockPrisma.reservation.findUnique.mockResolvedValue(
        reservationWithSegments()
      );

      const response = await request(app)
        .post('/api/reservations')
        .send(reservationData)
        .expect(201);

      expect(response.body.id).toBe(1);
      expect(response.body.mainClientId).toBe(1);
      expect(global.mockPrisma.cargo.create).toHaveBeenCalled();
      const cargoData = global.mockPrisma.cargo.create.mock.calls[0][0].data;
      expect(cargoData.roomTypeId).toBe(1);
      expect(cargoData.serviceTypeId).toBe('svc-desayuno');
      expect(cargoData.tipo).toBeUndefined();
    });

    it('debería validar campos requeridos', async () => {
      const invalidData = { roomId: 1 };

      await request(app)
        .post('/api/reservations')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PUT /api/reservations/:id', () => {
    it('debería actualizar una reserva existente', async () => {
      global.mockPrisma.reservation.findUnique.mockResolvedValue(
        reservationWithSegments()
      );
      global.mockPrisma.reservation.update.mockResolvedValue({
        id: 1,
        status: 'CONFIRMADA'
      });

      const response = await request(app)
        .put('/api/reservations/1')
        .send({ status: 'CONFIRMADA' })
        .expect(200);

      expect(response.body.id).toBe(1);
    });

    it('debería devolver 404 si la reserva no existe', async () => {
      global.mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await request(app)
        .put('/api/reservations/999')
        .send({ notes: 'actualizada' })
        .expect(404);
    });
  });
});
