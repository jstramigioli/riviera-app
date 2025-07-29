const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Períodos Operacionales', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.operationalPeriod.findMany.mockResolvedValue([]);
    global.mockPrisma.operationalPeriod.findFirst.mockResolvedValue(null);
    global.mockPrisma.operationalPeriod.findUnique.mockResolvedValue(null);
    global.mockPrisma.operationalPeriod.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.operationalPeriod.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.operationalPeriod.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.seasonalKeyframe.findMany.mockResolvedValue([]);
    global.mockPrisma.seasonalKeyframe.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.seasonalKeyframe.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.seasonalKeyframe.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/operational-periods/:hotelId', () => {
    it('debería devolver todos los períodos operacionales', async () => {
      const mockPeriods = [
        {
          id: 1,
          hotelId: 'test-hotel',
          startDate: new Date('2024-01-01T12:00:00.000Z'),
          endDate: new Date('2024-03-31T12:00:00.000Z'),
          label: 'Temporada Alta'
        },
        {
          id: 2,
          hotelId: 'test-hotel',
          startDate: new Date('2024-04-01T12:00:00.000Z'),
          endDate: new Date('2024-06-30T12:00:00.000Z'),
          label: 'Temporada Media'
        }
      ];
      
      global.mockPrisma.operationalPeriod.findMany.mockResolvedValue(mockPeriods);

      const response = await request(app)
        .get('/api/operational-periods/test-hotel')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].label).toBe('Temporada Alta');
      expect(response.body[1].label).toBe('Temporada Media');
    });

    it('debería devolver array vacío si no hay períodos', async () => {
      global.mockPrisma.operationalPeriod.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/operational-periods/test-hotel')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.operationalPeriod.findMany.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .get('/api/operational-periods/test-hotel')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('POST /api/operational-periods/:hotelId', () => {
    it('debería crear un nuevo período operacional', async () => {
      const periodData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        label: 'Temporada Alta'
      };

      const mockCreatedPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2024-03-31T12:00:00.000Z'),
        label: 'Temporada Alta'
      };
      
      global.mockPrisma.operationalPeriod.create.mockResolvedValue(mockCreatedPeriod);

      const response = await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(periodData)
        .expect(201);

      expect(response.body.hotelId).toBe('test-hotel');
      expect(response.body.label).toBe('Temporada Alta');
      expect(response.body.startDate).toBe('2024-01-01T12:00:00.000Z');
      expect(response.body.endDate).toBe('2024-03-31T12:00:00.000Z');
    });

    it('debería devolver error 400 si las fechas son inválidas', async () => {
      const invalidPeriodData = {
        startDate: 'fecha-invalida',
        endDate: '2024-03-31',
        label: 'Temporada Alta'
      };

      await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(invalidPeriodData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Fechas inválidas');
        });
    });

    it('debería devolver error 400 si endDate es anterior a startDate', async () => {
      const invalidPeriodData = {
        startDate: '2024-03-31',
        endDate: '2024-01-01', // Fecha anterior
        label: 'Temporada Alta'
      };

      await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(invalidPeriodData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('La fecha de inicio debe ser anterior a la fecha de fin');
        });
    });

    it('debería devolver error 409 si hay solapamiento con período existente', async () => {
      const overlappingPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-02-01T12:00:00.000Z'),
        endDate: new Date('2024-04-30T12:00:00.000Z'),
        label: 'Período Existente'
      };
      
      global.mockPrisma.operationalPeriod.findFirst.mockResolvedValue(overlappingPeriod);

      const periodData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        label: 'Nuevo Período'
      };

      await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(periodData)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe('Existe un período que se solapa con las fechas especificadas');
          expect(res.body.overlappingPeriod).toBeDefined();
        });
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.operationalPeriod.create.mockRejectedValue(new Error('Error de BD'));

      const periodData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        label: 'Temporada Alta'
      };

      await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(periodData)
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('PUT /api/operational-periods/:id', () => {
    it('debería actualizar un período operacional existente', async () => {
      const existingPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2024-03-31T12:00:00.000Z'),
        label: 'Temporada Alta'
      };
      
      global.mockPrisma.operationalPeriod.findUnique.mockResolvedValue(existingPeriod);
      global.mockPrisma.operationalPeriod.findFirst.mockResolvedValue(null);

      const updateData = {
        startDate: '2024-01-15',
        endDate: '2024-04-15',
        label: 'Temporada Alta Actualizada'
      };

      const mockUpdatedPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-15T12:00:00.000Z'),
        endDate: new Date('2024-04-15T12:00:00.000Z'),
        label: 'Temporada Alta Actualizada'
      };
      
      global.mockPrisma.operationalPeriod.update.mockResolvedValue(mockUpdatedPeriod);

      const response = await request(app)
        .put('/api/operational-periods/1')
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.label).toBe('Temporada Alta Actualizada');
      expect(response.body.startDate).toBe('2024-01-15T12:00:00.000Z');
      expect(response.body.endDate).toBe('2024-04-15T12:00:00.000Z');
    });

    it('debería devolver error 400 si las fechas son inválidas', async () => {
      const invalidUpdateData = {
        startDate: 'fecha-invalida',
        endDate: '2024-04-15',
        label: 'Temporada Alta'
      };

      await request(app)
        .put('/api/operational-periods/1')
        .send(invalidUpdateData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Fechas inválidas');
        });
    });

    it('debería devolver error 400 si endDate es anterior a startDate', async () => {
      const invalidUpdateData = {
        startDate: '2024-04-15',
        endDate: '2024-01-15', // Fecha anterior
        label: 'Temporada Alta'
      };

      await request(app)
        .put('/api/operational-periods/1')
        .send(invalidUpdateData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('La fecha de inicio debe ser anterior a la fecha de fin');
        });
    });

    it('debería devolver error 409 si hay solapamiento con otro período', async () => {
      const existingPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2024-03-31T12:00:00.000Z'),
        label: 'Temporada Alta'
      };
      
      const overlappingPeriod = {
        id: 2,
        hotelId: 'test-hotel',
        startDate: new Date('2024-02-01T12:00:00.000Z'),
        endDate: new Date('2024-04-30T12:00:00.000Z'),
        label: 'Otro Período'
      };
      
      global.mockPrisma.operationalPeriod.findUnique.mockResolvedValue(existingPeriod);
      global.mockPrisma.operationalPeriod.findFirst.mockResolvedValue(overlappingPeriod);

      const updateData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        label: 'Período Actualizado'
      };

      await request(app)
        .put('/api/operational-periods/1')
        .send(updateData)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe('Existe otro período que se solapa con las fechas especificadas');
        });
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.operationalPeriod.update.mockRejectedValue(new Error('Error de BD'));

      const updateData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        label: 'Temporada Alta'
      };

      await request(app)
        .put('/api/operational-periods/1')
        .send(updateData)
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('DELETE /api/operational-periods/:id', () => {
    it('debería eliminar un período operacional existente', async () => {
      const existingPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2024-03-31T12:00:00.000Z'),
        label: 'Temporada Alta'
      };
      
      global.mockPrisma.operationalPeriod.findUnique.mockResolvedValue(existingPeriod);
      global.mockPrisma.seasonalKeyframe.findMany.mockResolvedValue([]);
      global.mockPrisma.operationalPeriod.delete.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/operational-periods/1')
        .expect(200);

      expect(response.body.message).toBe('Período operacional eliminado correctamente');
    });

    it('debería devolver error 404 si el período no existe', async () => {
      global.mockPrisma.operationalPeriod.findUnique.mockResolvedValue(null);

      await request(app)
        .delete('/api/operational-periods/1')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Período operacional no encontrado');
        });
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.operationalPeriod.findUnique.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .delete('/api/operational-periods/1')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('Validaciones de fechas', () => {
    it('debería validar formato de fecha correcto', async () => {
      const validPeriodData = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        label: 'Año Completo'
      };

      const mockCreatedPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2024-12-31T12:00:00.000Z'),
        label: 'Año Completo'
      };
      
      global.mockPrisma.operationalPeriod.create.mockResolvedValue(mockCreatedPeriod);

      const response = await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(validPeriodData)
        .expect(201);

      expect(response.body.startDate).toBe('2024-01-01T12:00:00.000Z');
      expect(response.body.endDate).toBe('2024-12-31T12:00:00.000Z');
    });

    it('debería rechazar fechas con formato incorrecto', async () => {
      const invalidPeriodData = {
        startDate: '01/01/2024', // Formato incorrecto
        endDate: '31/12/2024',   // Formato incorrecto
        label: 'Período Inválido'
      };

      await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(invalidPeriodData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Fechas inválidas');
        });
    });
  });

  describe('Casos edge', () => {
    it('debería manejar períodos muy largos', async () => {
      const longPeriod = {
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        label: 'Período Largo'
      };

      const mockCreatedPeriod = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01T12:00:00.000Z'),
        endDate: new Date('2025-12-31T12:00:00.000Z'),
        label: 'Período Largo'
      };
      
      global.mockPrisma.operationalPeriod.create.mockResolvedValue(mockCreatedPeriod);

      const response = await request(app)
        .post('/api/operational-periods/test-hotel')
        .send(longPeriod)
        .expect(201);

      expect(response.body.startDate).toBe('2024-01-01T12:00:00.000Z');
      expect(response.body.endDate).toBe('2025-12-31T12:00:00.000Z');
    });
  });
}); 