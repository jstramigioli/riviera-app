const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Reservas', () => {
  let testRoom;
  let testClient;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.room.findMany.mockResolvedValue([]);
    global.mockPrisma.room.findUnique.mockResolvedValue(null);
    global.mockPrisma.room.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    
    global.mockPrisma.client.findMany.mockResolvedValue([]);
    global.mockPrisma.client.findUnique.mockResolvedValue(null);
    global.mockPrisma.client.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    
    global.mockPrisma.reservation.findMany.mockResolvedValue([]);
    global.mockPrisma.reservation.findUnique.mockResolvedValue(null);
    global.mockPrisma.reservation.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.reservation.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.reservation.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.reservation.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/reservations', () => {
    it('debería devolver todas las reservas', async () => {
      const mockReservations = [
        { id: 1, roomId: 1, mainClientId: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' },
        { id: 2, roomId: 2, mainClientId: 2, checkIn: '2024-01-05', checkOut: '2024-01-07' }
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
    it('debería crear una nueva reserva', async () => {
      const reservationData = {
        roomId: 1,
        mainClientId: 1,
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        requiredGuests: 2,
        status: 'active',
        totalAmount: 1000
      };

      global.mockPrisma.reservation.create.mockResolvedValue({ id: 1, ...reservationData });

      const response = await request(app)
        .post('/api/reservations')
        .send(reservationData)
        .expect(201);

      expect(response.body.roomId).toBe(1);
      expect(response.body.mainClientId).toBe(1);
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
    it('debería manejar actualizaciones de drag and drop', async () => {
      const dragDropData = {
        roomId: 1,
        checkIn: '2024-01-05',
        checkOut: '2024-01-07'
      };

      const updatedReservation = {
        id: 1,
        roomId: 1,
        checkIn: '2024-01-05T00:00:00.000Z',
        checkOut: '2024-01-07T00:00:00.000Z',
        requiredGuests: 2
      };

      global.mockPrisma.reservation.update.mockResolvedValue(updatedReservation);

      const response = await request(app)
        .put('/api/reservations/1')
        .send(dragDropData)
        .expect(200);

      expect(response.body.checkIn).toContain('2024-01-05');
      expect(response.body.checkOut).toContain('2024-01-07');
      expect(response.body.requiredGuests).toBe(2);
    });
  });
}); 