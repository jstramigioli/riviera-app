const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Clientes', () => {
  let testClient;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.client.findMany.mockResolvedValue([]);
    global.mockPrisma.client.findUnique.mockResolvedValue(null);
    global.mockPrisma.client.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.client.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.client.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.client.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/clients', () => {
    it('debería devolver todos los clientes', async () => {
      const mockClients = [
        { id: 1, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com' },
        { id: 2, firstName: 'María', lastName: 'García', email: 'maria@example.com' }
      ];
      
      global.mockPrisma.client.findMany.mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].firstName).toBe('Juan');
    });

    it('debería soportar parámetro de búsqueda', async () => {
      const mockClients = [
        { id: 1, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com' }
      ];
      
      global.mockPrisma.client.findMany.mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients?search=Juan')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].firstName).toContain('Juan');
    });
  });

  describe('GET /api/clients/:id', () => {
    it('debería devolver un cliente específico', async () => {
      const mockClient = {
        id: 1,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '987654321',
        documentType: 'DNI',
        documentNumber: '87654321'
      };
      
      global.mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      const response = await request(app)
        .get('/api/clients/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.firstName).toBe('Jane');
      expect(response.body.lastName).toBe('Smith');
    });

    it('debería devolver 404 para cliente inexistente', async () => {
      global.mockPrisma.client.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/clients/99999')
        .expect(404);
    });
  });

  describe('POST /api/clients', () => {
    it('debería crear un nuevo cliente', async () => {
      const clientData = {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        phone: '555123456',
        documentType: 'DNI',
        documentNumber: '11223344',
        country: 'AR',
        province: 'Córdoba',
        city: 'Córdoba',
        wantsPromotions: true
      };

      global.mockPrisma.client.create.mockResolvedValue({ id: 1, ...clientData });

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      expect(response.body.firstName).toBe('Alice');
      expect(response.body.lastName).toBe('Johnson');
      expect(response.body.email).toBe('alice@example.com');
      expect(response.body.wantsPromotions).toBe(true);
    });

    it('debería validar campos requeridos', async () => {
      const invalidData = {
        firstName: 'Test',
        // Faltan lastName y otros campos requeridos
      };

      await request(app)
        .post('/api/clients')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar formato de email', async () => {
      const invalidData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'invalid-email',
        documentType: 'DNI',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/api/clients')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('debería actualizar un cliente', async () => {
      const updateData = {
        firstName: 'Robert',
        phone: '999888777',
        wantsPromotions: true
      };

      const updatedClient = {
        id: 1,
        firstName: 'Robert',
        lastName: 'Wilson',
        phone: '999888777',
        wantsPromotions: true
      };

      global.mockPrisma.client.update.mockResolvedValue(updatedClient);

      const response = await request(app)
        .put('/api/clients/1')
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe('Robert');
      expect(response.body.phone).toBe('999888777');
      expect(response.body.wantsPromotions).toBe(true);
      expect(response.body.lastName).toBe('Wilson'); // No debería cambiar
    });

    it('debería devolver 404 para cliente inexistente', async () => {
      global.mockPrisma.client.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        firstName: 'Updated'
      };

      await request(app)
        .put('/api/clients/99999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('debería eliminar un cliente', async () => {
      global.mockPrisma.client.delete.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/clients/1')
        .expect(204);
    });

    it('debería devolver 404 para cliente inexistente', async () => {
      global.mockPrisma.client.delete.mockRejectedValue(new Error('Record not found'));

      await request(app)
        .delete('/api/clients/99999')
        .expect(404);
    });
  });
});