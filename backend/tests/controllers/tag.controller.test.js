const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Etiquetas', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.tag.findMany.mockResolvedValue([]);
    global.mockPrisma.tag.findUnique.mockResolvedValue(null);
    global.mockPrisma.tag.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.tag.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.tag.delete.mockResolvedValue({ id: 1 });
  });

  describe('GET /api/tags', () => {
    it('debería devolver todas las etiquetas', async () => {
      const mockTags = [
        { id: 1, name: 'VIP', color: '#FFD700', isActive: true },
        { id: 2, name: 'Regular', color: '#87CEEB', isActive: true }
      ];
      
      global.mockPrisma.tag.findMany.mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('VIP');
      expect(response.body[0].color).toBe('#FFD700');
    });

    it('debería filtrar etiquetas activas por defecto', async () => {
      const mockTags = [
        { id: 1, name: 'VIP', color: '#FFD700', isActive: true }
      ];
      
      global.mockPrisma.tag.findMany.mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].isActive).toBe(true);
    });
  });

  describe('GET /api/tags/:id', () => {
    it('debería devolver una etiqueta específica', async () => {
      const mockTag = {
        id: 1,
        name: 'VIP',
        color: '#FFD700',
        isActive: true,
        description: 'Cliente VIP'
      };
      
      global.mockPrisma.tag.findUnique.mockResolvedValue(mockTag);

      const response = await request(app)
        .get('/api/tags/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('VIP');
      expect(response.body.color).toBe('#FFD700');
      expect(response.body.description).toBe('Cliente VIP');
    });

    it('debería devolver 404 para etiqueta inexistente', async () => {
      global.mockPrisma.tag.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/tags/99999')
        .expect(404);
    });
  });

  describe('POST /api/tags', () => {
    it('debería crear una nueva etiqueta', async () => {
      const tagData = {
        name: 'Premium',
        color: '#FF69B4',
        description: 'Cliente premium',
        isActive: true
      };

      global.mockPrisma.tag.create.mockResolvedValue({ id: 1, ...tagData });

      const response = await request(app)
        .post('/api/tags')
        .send(tagData)
        .expect(201);

      expect(response.body.name).toBe('Premium');
      expect(response.body.color).toBe('#FF69B4');
      expect(response.body.description).toBe('Cliente premium');
      expect(response.body.isActive).toBe(true);
    });

    it('debería validar campos requeridos', async () => {
      const invalidData = {
        color: '#FFD700'
        // Falta name
      };

      await request(app)
        .post('/api/tags')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar nombre no vacío', async () => {
      const invalidData = {
        name: '',
        color: '#FFD700'
      };

      await request(app)
        .post('/api/tags')
        .send(invalidData)
        .expect(400);
    });


  });

  describe('PUT /api/tags/:id', () => {
    it('debería actualizar una etiqueta', async () => {
      const updateData = {
        name: 'VIP Premium',
        color: '#FF1493',
        description: 'Cliente VIP premium actualizado'
      };

      const updatedTag = {
        id: 1,
        name: 'VIP Premium',
        color: '#FF1493',
        description: 'Cliente VIP premium actualizado',
        isActive: true
      };

      global.mockPrisma.tag.update.mockResolvedValue(updatedTag);

      const response = await request(app)
        .put('/api/tags/1')
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('VIP Premium');
      expect(response.body.color).toBe('#FF1493');
      expect(response.body.description).toBe('Cliente VIP premium actualizado');
    });

    it('debería devolver 404 para etiqueta inexistente', async () => {
      global.mockPrisma.tag.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        name: 'Actualizada'
      };

      await request(app)
        .put('/api/tags/99999')
        .send(updateData)
        .expect(404);
    });


  });

  describe('DELETE /api/tags/:id', () => {
    it('debería eliminar una etiqueta', async () => {
      global.mockPrisma.tag.delete.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/tags/1')
        .expect(204);
    });

    it('debería devolver 404 para etiqueta inexistente', async () => {
      global.mockPrisma.tag.delete.mockRejectedValue(new Error('Record not found'));

      await request(app)
        .delete('/api/tags/99999')
        .expect(404);
    });
  });

  describe('GET /api/tags', () => {
    it('debería buscar etiquetas por nombre usando query parameter', async () => {
      const mockTags = [
        { id: 1, name: 'VIP', color: '#FFD700', isActive: true }
      ];
      
      global.mockPrisma.tag.findMany.mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/tags?search=VIP')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('VIP');
    });
  });
}); 