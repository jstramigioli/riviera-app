const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Pagos', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.payment.findMany.mockResolvedValue([]);
    global.mockPrisma.payment.findUnique.mockResolvedValue(null);
    global.mockPrisma.payment.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.payment.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.payment.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.payment.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/payments', () => {
    it('debería devolver todos los pagos', async () => {
      const mockPayments = [
        { id: 1, amount: 1000, method: 'cash', reservationId: 1, date: '2024-01-01' },
        { id: 2, amount: 500, method: 'card', reservationId: 2, date: '2024-01-02' }
      ];
      
      global.mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/payments')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].amount).toBe(1000);
    });

    it('debería filtrar pagos por reserva', async () => {
      const mockPayments = [
        { id: 1, amount: 1000, method: 'cash', reservationId: 1, date: '2024-01-01' }
      ];
      
      global.mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/payments?reservationId=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].reservationId).toBe(1);
    });

    it('debería filtrar pagos por método', async () => {
      const mockPayments = [
        { id: 1, amount: 1000, method: 'cash', reservationId: 1, date: '2024-01-01' }
      ];
      
      global.mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/payments?method=cash')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].method).toBe('cash');
    });
  });

  describe('GET /api/payments/guest/:guestId', () => {
    it('debería devolver pagos de un huésped específico', async () => {
      const mockPayments = [
        { id: 1, amount: 1000, method: 'cash', guestId: 1, date: '2024-01-01' },
        { id: 2, amount: 500, method: 'card', guestId: 1, date: '2024-01-02' }
      ];
      
      global.mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/payments/guest/1')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].guestId).toBe(1);
    });
  });

  describe('POST /api/payments', () => {
    it('debería crear un nuevo pago', async () => {
      const paymentData = {
        guestId: 1,
        amount: 1500,
        type: 'payment',
        description: 'Pago con tarjeta de crédito',
        date: '2024-01-15'
      };

      global.mockPrisma.payment.create.mockResolvedValue({ id: 1, ...paymentData });

      const response = await request(app)
        .post('/api/payments')
        .send(paymentData)
        .expect(201);

      expect(response.body.amount).toBe(1500);
      expect(response.body.type).toBe('payment');
      expect(response.body.guestId).toBe(1);
      expect(response.body.description).toBe('Pago con tarjeta de crédito');
    });

    it('debería validar campos requeridos', async () => {
      const invalidData = {
        method: 'cash'
        // Faltan amount, reservationId, date
      };

      await request(app)
        .post('/api/payments')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar monto positivo', async () => {
      const invalidData = {
        amount: -100,
        method: 'cash',
        reservationId: 1,
        date: '2024-01-15'
      };

      await request(app)
        .post('/api/payments')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar método de pago válido', async () => {
      const invalidData = {
        amount: 1000,
        method: 'invalid_method',
        reservationId: 1,
        date: '2024-01-15'
      };

      await request(app)
        .post('/api/payments')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PUT /api/payments/:id', () => {
    it('debería actualizar un pago', async () => {
      const updateData = {
        amount: 1200,
        notes: 'Pago actualizado'
      };

      const updatedPayment = {
        id: 1,
        amount: 1200,
        method: 'cash',
        reservationId: 1,
        date: '2024-01-01',
        notes: 'Pago actualizado'
      };

      global.mockPrisma.payment.update.mockResolvedValue(updatedPayment);

      const response = await request(app)
        .put('/api/payments/1')
        .send(updateData)
        .expect(200);

      expect(response.body.amount).toBe(1200);
      expect(response.body.notes).toBe('Pago actualizado');
      expect(response.body.method).toBe('cash'); // No debería cambiar
    });

    it('debería devolver 404 para pago inexistente', async () => {
      global.mockPrisma.payment.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        amount: 1000
      };

      await request(app)
        .put('/api/payments/99999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/payments/:id', () => {
    it('debería eliminar un pago', async () => {
      global.mockPrisma.payment.delete.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/payments/1')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('debería devolver 404 para pago inexistente', async () => {
      global.mockPrisma.payment.delete.mockRejectedValue(new Error('Record not found'));

      await request(app)
        .delete('/api/payments/99999')
        .expect(404);
    });
  });

  describe('POST /api/payments/reservation-charge', () => {
    it('debería crear cargo automático por reserva', async () => {
      const chargeData = {
        guestId: 1,
        amount: 1000,
        description: 'Cargo por reserva'
      };

      global.mockPrisma.payment.create.mockResolvedValue({ id: 1, ...chargeData });

      const response = await request(app)
        .post('/api/payments/reservation-charge')
        .send(chargeData)
        .expect(201);

      expect(response.body.guestId).toBe(1);
      expect(response.body.amount).toBe(1000);
    });
  });
}); 