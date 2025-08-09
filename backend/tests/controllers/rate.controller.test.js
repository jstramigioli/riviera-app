const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Tarifas', () => {
  let testRate;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.dailyRate.findMany.mockResolvedValue([]);
    global.mockPrisma.dailyRate.findUnique.mockResolvedValue(null);
    global.mockPrisma.dailyRate.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.dailyRate.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.dailyRate.upsert.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.create })
    );
    global.mockPrisma.dailyRate.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.room.count.mockResolvedValue(10);
    global.mockPrisma.reservation.count.mockResolvedValue(5);
  });

  describe('GET /api/rates/rates', () => {
    it('debería devolver tarifas para un rango de fechas', async () => {
      const mockRates = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          price: 100, 
          minStay: 1,
          roomType: { id: 1, name: 'Habitación Estándar' }
        },
        { 
          id: 2, 
          date: new Date('2024-01-02'), 
          price: 120, 
          minStay: 2,
          roomType: { id: 1, name: 'Habitación Estándar' }
        }
      ];
      
      global.mockPrisma.dailyRate.findMany.mockResolvedValue(mockRates);

      const response = await request(app)
        .get('/api/rates/rates?startDate=2024-01-01&endDate=2024-01-02')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].price).toBe(100);
      expect(response.body[1].price).toBe(120);
    });

    it('debería filtrar por roomTypeId', async () => {
      const mockRates = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          price: 100, 
          roomTypeId: 1,
          roomType: { id: 1, name: 'Habitación Estándar' }
        }
      ];
      
      global.mockPrisma.dailyRate.findMany.mockResolvedValue(mockRates);

      const response = await request(app)
        .get('/api/rates/rates?startDate=2024-01-01&endDate=2024-01-01&roomTypeId=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].roomTypeId).toBe(1);
    });

    it('debería devolver error 400 si faltan parámetros requeridos', async () => {
      await request(app)
        .get('/api/rates/rates?startDate=2024-01-01')
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('startDate y endDate son requeridos');
        });
    });

    it('debería devolver error 400 si faltan ambos parámetros', async () => {
      await request(app)
        .get('/api/rates/rates')
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('startDate y endDate son requeridos');
        });
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dailyRate.findMany.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .get('/api/rates/rates?startDate=2024-01-01&endDate=2024-01-01')
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Error de BD');
        });
    });
  });

  describe('POST /api/rates/rates', () => {
    it('debería crear tarifas para un rango de fechas', async () => {
      const mockCreatedRates = [
        { id: 1, date: new Date('2024-01-01'), price: 100, minStay: 1, roomTypeId: 1 },
        { id: 2, date: new Date('2024-01-02'), price: 100, minStay: 1, roomTypeId: 1 }
      ];
      
      global.mockPrisma.dailyRate.upsert.mockResolvedValueOnce(mockCreatedRates[0]);
      global.mockPrisma.dailyRate.upsert.mockResolvedValueOnce(mockCreatedRates[1]);

      const rateData = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        roomTypeId: 1,
        price: 100,
        minStay: 1
      };

      const response = await request(app)
        .post('/api/rates/rates')
        .send(rateData)
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });

    it('debería devolver error 400 si faltan campos requeridos', async () => {
      const incompleteData = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        price: 100
        // Falta roomTypeId
      };

      await request(app)
        .post('/api/rates/rates')
        .send(incompleteData)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Faltan campos requeridos');
        });
    });

    it('debería devolver error 400 si endDate es anterior a startDate', async () => {
      const invalidData = {
        startDate: '2024-01-02',
        endDate: '2024-01-01', // Fecha anterior
        roomTypeId: 1,
        price: 100,
        minStay: 1
      };

      await request(app)
        .post('/api/rates/rates')
        .send(invalidData)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('endDate debe ser posterior a startDate');
        });
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dailyRate.upsert.mockRejectedValue(new Error('Error de BD'));

      const rateData = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        roomTypeId: 1,
        price: 100,
        minStay: 1
      };

      await request(app)
        .post('/api/rates/rates')
        .send(rateData)
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Error de BD');
        });
    });
  });

  describe('PATCH /api/rates/rates/:id', () => {
    it('debería actualizar una tarifa existente', async () => {
      const updatedRate = {
        id: 1,
        date: new Date('2024-01-01'),
        price: 150,
        minStay: 2,
        roomTypeId: 1
      };
      
      global.mockPrisma.dailyRate.update.mockResolvedValue(updatedRate);

      const updateData = {
        price: 150,
        minStay: 2
      };

      const response = await request(app)
        .patch('/api/rates/rates/1')
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.price).toBe(150);
      expect(response.body.minStay).toBe(2);
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dailyRate.update.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .patch('/api/rates/rates/1')
        .send({ price: 150 })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Error de BD');
        });
    });
  });

  describe('DELETE /api/rates/rates/:id', () => {
    it('debería eliminar una tarifa existente', async () => {
      global.mockPrisma.dailyRate.delete.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/rates/rates/1')
        .expect(204);
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dailyRate.delete.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .delete('/api/rates/rates/1')
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Error de BD');
        });
    });
  });

  describe('POST /api/rates/rates/suggest', () => {
    it('debería sugerir precio dinámico basado en ocupación', async () => {
      const suggestData = {
        date: '2024-01-01',
        roomTypeId: 1,
        basePrice: 100
      };

      const response = await request(app)
        .post('/api/rates/rates/suggest')
        .send(suggestData)
        .expect(200);

      expect(response.body).toHaveProperty('precio');
      expect(response.body).toHaveProperty('ocupacion');
      expect(response.body.ocupacion).toBe(0.5); // 5/10 habitaciones
    });

    it('debería manejar caso de ocupación baja (descuento)', async () => {
      global.mockPrisma.room.count.mockResolvedValue(10);
      global.mockPrisma.reservation.count.mockResolvedValue(2); // 20% ocupación

      const suggestData = {
        date: '2024-01-01',
        roomTypeId: 1,
        basePrice: 100
      };

      const response = await request(app)
        .post('/api/rates/rates/suggest')
        .send(suggestData)
        .expect(200);

      expect(response.body.precio).toBe(90); // 100 * 0.9 (descuento)
    });

    it('debería manejar caso de ocupación alta (incremento)', async () => {
      global.mockPrisma.room.count.mockResolvedValue(10);
      global.mockPrisma.reservation.count.mockResolvedValue(9); // 90% ocupación

      const suggestData = {
        date: '2024-01-01',
        roomTypeId: 1,
        basePrice: 100
      };

      const response = await request(app)
        .post('/api/rates/rates/suggest')
        .send(suggestData)
        .expect(200);

      expect(response.body.precio).toBeCloseTo(115, 2); // 100 * 1.15 (incremento)
    });

    it('debería manejar caso sin habitaciones disponibles', async () => {
      global.mockPrisma.room.count.mockResolvedValue(0);
      global.mockPrisma.reservation.count.mockResolvedValue(0);

      const suggestData = {
        date: '2024-01-01',
        roomTypeId: 1,
        basePrice: 100
      };

      const response = await request(app)
        .post('/api/rates/rates/suggest')
        .send(suggestData)
        .expect(200);

      expect(response.body.ocupacion).toBe(0);
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.room.count.mockRejectedValue(new Error('Error de BD'));

      const suggestData = {
        date: '2024-01-01',
        roomTypeId: 1,
        basePrice: 100
      };

      await request(app)
        .post('/api/rates/rates/suggest')
        .send(suggestData)
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Error de BD');
        });
    });
  });
}); 