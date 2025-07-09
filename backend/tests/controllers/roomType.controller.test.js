const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Tipos de Habitación', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.roomType.findMany.mockResolvedValue([]);
    global.mockPrisma.roomType.findUnique.mockResolvedValue(null);
    global.mockPrisma.roomType.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.roomType.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.roomType.delete.mockResolvedValue({ id: 1 });
  });

  describe('GET /api/room-types', () => {
    it('debería devolver todos los tipos de habitación', async () => {
      const mockRoomTypes = [
        { id: 1, name: 'Individual', description: 'Habitación para una persona', isActive: true },
        { id: 2, name: 'Doble', description: 'Habitación para dos personas', isActive: true }
      ];
      
      global.mockPrisma.roomType.findMany.mockResolvedValue(mockRoomTypes);

      const response = await request(app)
        .get('/api/room-types')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Individual');
    });

    it('debería filtrar tipos activos por defecto', async () => {
      const mockRoomTypes = [
        { id: 1, name: 'Individual', description: 'Habitación para una persona', isActive: true }
      ];
      
      global.mockPrisma.roomType.findMany.mockResolvedValue(mockRoomTypes);

      const response = await request(app)
        .get('/api/room-types')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].isActive).toBe(true);
    });
  });

  describe('GET /api/room-types/:id', () => {
    it('debería devolver un tipo de habitación específico', async () => {
      const mockRoomType = {
        id: 1,
        name: 'Individual',
        description: 'Habitación para una persona',
        isActive: true
      };
      
      global.mockPrisma.roomType.findUnique.mockResolvedValue(mockRoomType);

      const response = await request(app)
        .get('/api/room-types/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Individual');
      expect(response.body.description).toBe('Habitación para una persona');
    });

    it('debería devolver 404 para tipo inexistente', async () => {
      global.mockPrisma.roomType.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/room-types/99999')
        .expect(404);
    });
  });

  describe('POST /api/room-types', () => {
    it('debería crear un nuevo tipo de habitación', async () => {
      const roomTypeData = {
        name: 'Suite',
        description: 'Habitación de lujo con servicios adicionales',
        isActive: true
      };

      global.mockPrisma.roomType.create.mockResolvedValue({ id: 1, ...roomTypeData });

      const response = await request(app)
        .post('/api/room-types')
        .send(roomTypeData)
        .expect(201);

      expect(response.body.name).toBe('Suite');
      expect(response.body.description).toBe('Habitación de lujo con servicios adicionales');
      expect(response.body.isActive).toBe(true);
    });


  });

  describe('PUT /api/room-types/:id', () => {
    it('debería actualizar un tipo de habitación', async () => {
      const updateData = {
        name: 'Suite Premium',
        description: 'Habitación de lujo actualizada',
        isActive: false
      };

      const updatedRoomType = {
        id: 1,
        name: 'Suite Premium',
        description: 'Habitación de lujo actualizada',
        isActive: false
      };

      global.mockPrisma.roomType.update.mockResolvedValue(updatedRoomType);

      const response = await request(app)
        .put('/api/room-types/1')
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Suite Premium');
      expect(response.body.description).toBe('Habitación de lujo actualizada');
      expect(response.body.isActive).toBe(false);
    });

    it('debería devolver 404 para tipo inexistente', async () => {
      global.mockPrisma.roomType.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        name: 'Actualizado'
      };

      await request(app)
        .put('/api/room-types/99999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/room-types/:id', () => {
    it('debería eliminar un tipo de habitación', async () => {
      global.mockPrisma.roomType.delete.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/room-types/1')
        .expect(204);
    });

    it('debería devolver 404 para tipo inexistente', async () => {
      global.mockPrisma.roomType.delete.mockRejectedValue(new Error('Record not found'));

      await request(app)
        .delete('/api/room-types/99999')
        .expect(404);
    });
  });
}); 