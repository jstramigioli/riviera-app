const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Precios Dinámicos', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(null);
    global.mockPrisma.dynamicPricingConfig.create.mockImplementation((data) =>
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.dynamicPricingConfig.update.mockImplementation((data) =>
      Promise.resolve({ id: 1, hotelId: 'test-hotel', ...data.data })
    );
    global.mockPrisma.dynamicPricingConfig.upsert.mockImplementation((data) =>
      Promise.resolve({ id: 1, ...data.create })
    );
  });

  describe('GET /api/dynamic-pricing/config/:hotelId', () => {
    it('debería devolver configuración de precios dinámicos', async () => {
      const mockConfig = {
        id: 1,
        hotelId: 'test-hotel',
        anticipationThresholds: [21, 14, 7, 3],
        anticipationWeight: 0.3,
        globalOccupancyWeight: 0.25,
        isWeekendWeight: 0.15,
        isHolidayWeight: 0.1,
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.05,
        maxAdjustmentPercentage: 0.4
      };

      global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/dynamic-pricing/config/test-hotel')
        .expect(200);

      expect(response.body.hotelId).toBe('test-hotel');
      expect(response.body.anticipationThresholds).toEqual([21, 14, 7, 3]);
      expect(response.body.maxAdjustmentPercentage).toBe(0.4);
    });

    it('debería crear configuración por defecto si no existe', async () => {
      global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(null);
      global.mockPrisma.dynamicPricingConfig.create.mockResolvedValue({
        id: 1,
        hotelId: 'test-hotel',
        enabled: false,
        anticipationThresholds: [7, 14, 30]
      });

      const response = await request(app)
        .get('/api/dynamic-pricing/config/test-hotel')
        .expect(200);

      expect(response.body.hotelId).toBe('test-hotel');
      expect(global.mockPrisma.dynamicPricingConfig.create).toHaveBeenCalled();
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dynamicPricingConfig.findUnique.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .get('/api/dynamic-pricing/config/test-hotel')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('PUT /api/dynamic-pricing/config/:hotelId', () => {
    it('debería crear nueva configuración', async () => {
      const configData = {
        anticipationThresholds: [21, 14, 7, 3],
        anticipationWeight: 0.3,
        maxAdjustmentPercentage: 0.4
      };

      global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(null);
      global.mockPrisma.dynamicPricingConfig.create.mockResolvedValue({
        id: 1,
        hotelId: 'test-hotel',
        ...configData
      });

      const response = await request(app)
        .put('/api/dynamic-pricing/config/test-hotel')
        .send(configData)
        .expect(200);

      expect(response.body.hotelId).toBe('test-hotel');
      expect(response.body.anticipationThresholds).toEqual([21, 14, 7, 3]);
    });

    it('debería actualizar configuración existente', async () => {
      const configData = {
        anticipationWeight: 0.4,
        maxAdjustmentPercentage: 0.5
      };

      global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue({
        id: 1,
        hotelId: 'test-hotel'
      });
      global.mockPrisma.dynamicPricingConfig.update.mockResolvedValue({
        id: 1,
        hotelId: 'test-hotel',
        ...configData
      });

      const response = await request(app)
        .put('/api/dynamic-pricing/config/test-hotel')
        .send(configData)
        .expect(200);

      expect(response.body.anticipationWeight).toBe(0.4);
      expect(response.body.maxAdjustmentPercentage).toBe(0.5);
    });

    it('debería manejar errores de base de datos', async () => {
      global.mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(null);
      global.mockPrisma.dynamicPricingConfig.create.mockRejectedValue(new Error('Error de BD'));

      await request(app)
        .put('/api/dynamic-pricing/config/test-hotel')
        .send({ anticipationWeight: 0.3 })
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Error interno del servidor');
        });
    });
  });

  describe('rutas de keyframes / coeficientes retiradas', () => {
    it('GET /keyframes responde 404', async () => {
      await request(app)
        .get('/api/dynamic-pricing/keyframes/test-hotel')
        .expect(404);
    });

    it('DELETE operational-keyframes responde 501 (schema no disponible)', async () => {
      const response = await request(app)
        .delete('/api/dynamic-pricing/operational-keyframes/1')
        .expect(501);

      expect(response.body.code).toBe('SCHEMA_UNAVAILABLE');
    });
  });

  describe('POST /api/dynamic-pricing/calculate-score/:hotelId/:date', () => {
    it('debería calcular score de ocupación esperada', async () => {
      const calculateData = {
        daysUntilDate: 10,
        currentOccupancy: 0.6,
        isWeekend: false,
        isHoliday: false,
        weatherScore: 0.9,
        eventImpact: 0.7
      };

      const response = await request(app)
        .post('/api/dynamic-pricing/calculate-score/test-hotel/2024-01-01')
        .send(calculateData)
        .expect(200);

      expect(response.body).toHaveProperty('score');
      expect(typeof response.body.score).toBe('number');
    });
  });
});
