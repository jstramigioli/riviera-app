const request = require('supertest');
const app = require('../../src/app');

describe('Controlador de Habitaciones', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    
    // Configurar mocks específicos para este test
    global.mockPrisma.room.findMany.mockResolvedValue([]);
    global.mockPrisma.room.findUnique.mockResolvedValue(null);
    global.mockPrisma.room.create.mockImplementation((data) => 
      Promise.resolve({ id: 1, ...data.data })
    );
    global.mockPrisma.room.update.mockImplementation((data) => 
      Promise.resolve({ id: data.where.id, ...data.data })
    );
    global.mockPrisma.room.delete.mockResolvedValue({ id: 1 });
    global.mockPrisma.room.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('GET /api/rooms', () => {
    it('debería devolver todas las habitaciones', async () => {
      const mockRooms = [
        { id: 1, name: 'Habitación 101', capacity: 2, price: 100.50, isActive: true },
        { id: 2, name: 'Habitación 102', capacity: 3, price: 150.00, isActive: true }
      ];
      
      global.mockPrisma.room.findMany.mockResolvedValue(mockRooms);

      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Habitación 101');
    });

    it('debería filtrar habitaciones activas por defecto', async () => {
      const mockRooms = [
        { id: 1, name: 'Habitación 101', capacity: 2, price: 100.50, isActive: true }
      ];
      
      global.mockPrisma.room.findMany.mockResolvedValue(mockRooms);

      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].isActive).toBe(true);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('debería devolver una habitación específica', async () => {
      const mockRoom = {
        id: 1,
        name: 'Habitación 101',
        capacity: 2,
        price: 100.50,
        isActive: true,
        roomTypeId: 1
      };
      
      global.mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .get('/api/rooms/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Habitación 101');
      expect(response.body.capacity).toBe(2);
    });

    it('debería devolver 404 para habitación inexistente', async () => {
      global.mockPrisma.room.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/rooms/99999')
        .expect(404);
    });
  });

  describe('POST /api/rooms', () => {
    it('debería crear una nueva habitación', async () => {
      const roomData = {
        name: 'Habitación 103',
        capacity: 4,
        price: 200.00,
        roomTypeId: 1,
        isActive: true
      };

      global.mockPrisma.room.create.mockResolvedValue({ id: 1, ...roomData });

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.name).toBe('Habitación 103');
      expect(response.body.capacity).toBe(4);
      expect(response.body.price).toBe(200.00);
      expect(response.body.isActive).toBe(true);
    });

    it('debería validar campos requeridos', async () => {
      const invalidData = {
        capacity: 2
        // Falta name
      };

      await request(app)
        .post('/api/rooms')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar capacidad positiva', async () => {
      const invalidData = {
        name: 'Habitación Test',
        capacity: -1,
        price: 100.00
      };

      await request(app)
        .post('/api/rooms')
        .send(invalidData)
        .expect(400);
    });

    it('debería validar precio positivo', async () => {
      const invalidData = {
        name: 'Habitación Test',
        capacity: 2,
        price: 0
      };

      await request(app)
        .post('/api/rooms')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PUT /api/rooms/:id', () => {
    it('debería actualizar una habitación', async () => {
      const updateData = {
        name: 'Habitación 101 Actualizada',
        price: 120.00,
        isActive: false
      };

      const updatedRoom = {
        id: 1,
        name: 'Habitación 101 Actualizada',
        capacity: 2,
        price: 120.00,
        isActive: false
      };

      global.mockPrisma.room.update.mockResolvedValue(updatedRoom);

      const response = await request(app)
        .put('/api/rooms/1')
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Habitación 101 Actualizada');
      expect(response.body.price).toBe(120.00);
      expect(response.body.isActive).toBe(false);
    });

    it('debería devolver 404 para habitación inexistente', async () => {
      global.mockPrisma.room.update.mockRejectedValue(new Error('Record not found'));

      const updateData = {
        name: 'Actualizada'
      };

      await request(app)
        .put('/api/rooms/99999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    it('debería eliminar una habitación', async () => {
      global.mockPrisma.room.delete.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/rooms/1')
        .expect(204);
    });

    it('debería devolver 404 para habitación inexistente', async () => {
      global.mockPrisma.room.delete.mockRejectedValue(new Error('Record not found'));

      await request(app)
        .delete('/api/rooms/99999')
        .expect(404);
    });
  });

  describe('GET /api/rooms', () => {
    it('debería filtrar habitaciones por tipo', async () => {
      const mockRooms = [
        { id: 1, name: 'Habitación 101', capacity: 2, price: 100.50, roomTypeId: 1 }
      ];
      
      global.mockPrisma.room.findMany.mockResolvedValue(mockRooms);

      const response = await request(app)
        .get('/api/rooms?roomTypeId=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].roomTypeId).toBe(1);
    });
  });
}); 