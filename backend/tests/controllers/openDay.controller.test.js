
// Mock de Prisma
const mockPrisma = {
  openDay: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

const openDayController = require('../../src/controllers/openDay.controller');

describe('OpenDay Controller', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      params: {},
      body: {}
    };
    
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOpenDays', () => {
    it('returns all open days', async () => {
      const mockOpenDays = [
        { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 },
        { id: 2, date: new Date('2024-01-02'), fixedPrice: 6000 }
      ];
      
      mockPrisma.openDay.findMany.mockResolvedValue(mockOpenDays);
      mockReq.params.hotelId = '1';
      
      await openDayController.getOpenDays(mockReq, mockRes);
      
      expect(mockPrisma.openDay.findMany).toHaveBeenCalledWith({
        where: { hotelId: '1' },
        orderBy: { date: 'asc' }
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDays);
    });

    it('handles database error', async () => {
      mockPrisma.openDay.findMany.mockRejectedValue(new Error('Database error'));
      mockReq.params.hotelId = '1';
      
      await openDayController.getOpenDays(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error interno del servidor' });
    });
  });

  describe('createOpenDay', () => {
    it('creates new open day', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 };
      mockReq.params.hotelId = '1';
      mockReq.body = {
        date: '2024-01-01',
        fixedPrice: 5000,
        notes: 'Test day'
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(null);
      mockPrisma.openDay.create.mockResolvedValue(mockOpenDay);
      
      await openDayController.createOpenDay(mockReq, mockRes);
      
      expect(mockPrisma.openDay.create).toHaveBeenCalledWith({
        data: {
          hotelId: '1',
          date: expect.any(Date),
          isClosed: true,
          isHoliday: false,
          fixedPrice: 5000,
          notes: 'Test day'
        }
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDay);
    });

    it('returns 409 when open day already exists', async () => {
      const existingOpenDay = { id: 1, date: new Date('2024-01-01') };
      mockReq.params.hotelId = '1';
      mockReq.body = { date: '2024-01-01' };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(existingOpenDay);
      
      await openDayController.createOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        message: 'Ya existe un registro para esta fecha',
        existingOpenDay 
      });
    });
  });

  describe('updateOpenDay', () => {
    it('updates open day', async () => {
      const updatedOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 6000 };
      
      mockReq.params.id = '1';
      mockReq.body = { 
        date: '2024-01-01',
        fixedPrice: 6000,
        notes: 'Updated day'
      };
      
      mockPrisma.openDay.update.mockResolvedValue(updatedOpenDay);
      
      await openDayController.updateOpenDay(mockReq, mockRes);
      
      expect(mockPrisma.openDay.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          date: expect.any(Date),
          isClosed: true,
          isHoliday: false,
          fixedPrice: 6000,
          notes: 'Updated day'
        }
      });
      expect(mockRes.json).toHaveBeenCalledWith(updatedOpenDay);
    });
  });

  describe('deleteOpenDay', () => {
    it('deletes open day', async () => {
      mockReq.params.id = '1';
      
      mockPrisma.openDay.delete.mockResolvedValue({ id: 1 });
      
      await openDayController.deleteOpenDay(mockReq, mockRes);
      
      expect(mockPrisma.openDay.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Día de apertura eliminado correctamente' });
    });
  });
}); 