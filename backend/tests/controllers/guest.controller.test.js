const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Huéspedes', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.guest.findMany.mockResolvedValue([]);
    global.mockPrisma.guest.findUnique.mockResolvedValue(null);
    global.mockPrisma.guest.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.guest.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.guest.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.guest.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/guests', () => {
    it('debería devolver todos los huéspedes', async () => {
      const mockGuests = [
        { id: 1, firstName: 'Juan', lastName: 'Pérez', documentNumber: '12345678', reservationId: 1 },
        { id: 2, firstName: 'María', lastName: 'García', documentNumber: '87654321', reservationId: 1 }
      ];
      
      global.mockPrisma.guest.findMany.mockResolvedValue(mockGuests);

      const response = await request(app)
        .get('/api/guests')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].firstName).toBe('Juan');
    });

    it('debería filtrar huéspedes por reserva', async () => {
      const mockGuests = [
        { id: 1, firstName: 'Juan', lastName: 'Pérez', documentNumber: '12345678', reservationId: 1 }
      ];
      
      global.mockPrisma.guest.findMany.mockResolvedValue(mockGuests);

      const response = await request(app)
        .get('/api/guests?reservationId=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].reservationId).toBe(1);
    });
  });

  describe('GET /api/guests/:id', () => {
    it('debería devolver un huésped específico', async () => {
      const mockGuest = {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        documentType: 'DNI',
        documentNumber: '12345678',
        reservationId: 1,
        isMainGuest: true
      };
      
      global.mockPrisma.guest.findUnique.mockResolvedValue(mockGuest);

      const response = await request(app)
        .get('/api/guests/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.firstName).toBe('Juan');
      expect(response.body.lastName).toBe('Pérez');
      expect(response.body.isMainGuest).toBe(true);
    });

    it('debería devolver 404 para huésped inexistente', async () => {
      global.mockPrisma.guest.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/guests/99999')
        .expect(404);
    });
  });

  describe('GET /api/guests/:id/balance', () => {
    it('debería calcular el balance de un huésped', async () => {
      const mockGuest = {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        payments: [
          { amount: 1000, type: 'charge' },
          { amount: 500, type: 'payment' }
        ]
      };
      
      global.mockPrisma.guest.findUnique.mockResolvedValue(mockGuest);

      const response = await request(app)
        .get('/api/guests/1/balance')
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('totalCharges');
      expect(response.body).toHaveProperty('totalPayments');
    });

    it('debería devolver 404 para huésped inexistente', async () => {
      global.mockPrisma.guest.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/guests/99999/balance')
        .expect(404);
    });
  });

  describe('PUT /api/guests/:id', () => {
    it('debería actualizar un huésped', async () => {
      const updateData = {
        firstName: 'Ana María',
        documentNumber: '99887766'
      };

      const updatedGuest = {
        id: 1,
        firstName: 'Ana María',
        lastName: 'López',
        documentNumber: '99887766',
        reservationId: 1
      };

      global.mockPrisma.guest.update.mockResolvedValue(updatedGuest);

      const response = await request(app)
        .put('/api/guests/1')
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe('Ana María');
      expect(response.body.documentNumber).toBe('99887766');
      expect(response.body.lastName).toBe('López'); // No debería cambiar
    });

    it('debería devolver 404 para huésped inexistente', async () => {
      global.mockPrisma.guest.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        firstName: 'Actualizado'
      };

      await request(app)
        .put('/api/guests/99999')
        .send(updateData)
        .expect(404);
    });
  });
}); 