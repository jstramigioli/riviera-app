const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const openDayController = require('../../src/controllers/openDay.controller');

// Mock de Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    openDay: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }))
}));

describe('OpenDay Controller', () => {
  let mockPrisma;
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    mockPrisma = new (require('@prisma/client').PrismaClient)();
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

  describe('getAllOpenDays', () => {
    it('returns all open days', async () => {
      const mockOpenDays = [
        { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 },
        { id: 2, date: new Date('2024-01-02'), fixedPrice: 6000 }
      ];
      
      mockPrisma.openDay.findMany.mockResolvedValue(mockOpenDays);
      
      await openDayController.getAllOpenDays(mockReq, mockRes);
      
      expect(mockPrisma.openDay.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' }
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDays);
    });

    it('handles database error', async () => {
      mockPrisma.openDay.findMany.mockRejectedValue(new Error('Database error'));
      
      await openDayController.getAllOpenDays(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getOpenDayById', () => {
    it('returns open day by id', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 };
      mockReq.params.id = '1';
      
      mockPrisma.openDay.findUnique.mockResolvedValue(mockOpenDay);
      
      await openDayController.getOpenDayById(mockReq, mockRes);
      
      expect(mockPrisma.openDay.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDay);
    });

    it('returns 404 when open day not found', async () => {
      mockReq.params.id = '999';
      mockPrisma.openDay.findUnique.mockResolvedValue(null);
      
      await openDayController.getOpenDayById(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Día abierto no encontrado' });
    });
  });

  describe('getOpenDayByDate', () => {
    it('returns open day by date', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 };
      mockReq.params.date = '2024-01-01';
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      await openDayController.getOpenDayByDate(mockReq, mockRes);
      
      expect(mockPrisma.openDay.findFirst).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDay);
    });

    it('returns 400 for invalid date', async () => {
      mockReq.params.date = 'invalid-date';
      
      await openDayController.getOpenDayByDate(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Fecha inválida' });
    });

    it('returns 404 when hotel is closed', async () => {
      mockReq.params.date = '2024-01-01';
      mockPrisma.openDay.findFirst.mockResolvedValue(null);
      
      await openDayController.getOpenDayByDate(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'El hotel está cerrado en esta fecha' });
    });
  });

  describe('createOpenDay', () => {
    it('creates new open day', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 };
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
          date: expect.any(Date),
          fixedPrice: 5000,
          notes: 'Test day'
        }
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockOpenDay);
    });

    it('returns 400 when date is missing', async () => {
      mockReq.body = { fixedPrice: 5000 };
      
      await openDayController.createOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'La fecha es requerida' });
    });

    it('returns 400 for invalid date', async () => {
      mockReq.body = { date: 'invalid-date' };
      
      await openDayController.createOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Fecha inválida' });
    });

    it('returns 409 when open day already exists', async () => {
      const existingOpenDay = { id: 1, date: new Date('2024-01-01') };
      mockReq.body = { date: '2024-01-01' };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(existingOpenDay);
      
      await openDayController.createOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ya existe un día abierto para esta fecha' });
    });
  });

  describe('updateOpenDay', () => {
    it('updates open day', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 };
      const updatedOpenDay = { id: 1, date: new Date('2024-01-01'), fixedPrice: 6000 };
      
      mockReq.params.id = '1';
      mockReq.body = { fixedPrice: 6000 };
      
      mockPrisma.openDay.findUnique.mockResolvedValue(mockOpenDay);
      mockPrisma.openDay.update.mockResolvedValue(updatedOpenDay);
      
      await openDayController.updateOpenDay(mockReq, mockRes);
      
      expect(mockPrisma.openDay.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { fixedPrice: 6000 }
      });
      expect(mockRes.json).toHaveBeenCalledWith(updatedOpenDay);
    });

    it('returns 404 when open day not found', async () => {
      mockReq.params.id = '999';
      mockPrisma.openDay.findUnique.mockResolvedValue(null);
      
      await openDayController.updateOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Día abierto no encontrado' });
    });

    it('returns 400 for invalid date in update', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01') };
      mockReq.params.id = '1';
      mockReq.body = { date: 'invalid-date' };
      
      mockPrisma.openDay.findUnique.mockResolvedValue(mockOpenDay);
      
      await openDayController.updateOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Fecha inválida' });
    });
  });

  describe('deleteOpenDay', () => {
    it('deletes open day', async () => {
      const mockOpenDay = { id: 1, date: new Date('2024-01-01') };
      mockReq.params.id = '1';
      
      mockPrisma.openDay.findUnique.mockResolvedValue(mockOpenDay);
      mockPrisma.openDay.delete.mockResolvedValue(mockOpenDay);
      
      await openDayController.deleteOpenDay(mockReq, mockRes);
      
      expect(mockPrisma.openDay.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Día abierto eliminado correctamente' });
    });

    it('returns 404 when open day not found', async () => {
      mockReq.params.id = '999';
      mockPrisma.openDay.findUnique.mockResolvedValue(null);
      
      await openDayController.deleteOpenDay(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Día abierto no encontrado' });
    });
  });
}); 