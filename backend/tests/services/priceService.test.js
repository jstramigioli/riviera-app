const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const priceService = require('../../src/services/priceService');

// Mock de Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    openDay: {
      findFirst: jest.fn()
    }
  }))
}));

describe('PriceService', () => {
  let mockPrisma;
  
  beforeEach(() => {
    mockPrisma = new (require('@prisma/client').PrismaClient)();
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPriceForDate', () => {
    it('returns null when hotel is closed', async () => {
      mockPrisma.openDay.findFirst.mockResolvedValue(null);
      
      const price = await priceService.getPriceForDate(new Date('2024-01-01'));
      
      expect(price).toBeNull();
      expect(mockPrisma.openDay.findFirst).toHaveBeenCalled();
    });

    it('returns fixed price when available', async () => {
      const mockOpenDay = {
        id: 1,
        date: new Date('2024-01-01'),
        fixedPrice: 7500, // $75 USD
        notes: 'Precio especial'
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      const price = await priceService.getPriceForDate(new Date('2024-01-01'));
      
      expect(price).toBe(7500);
    });

    it('calculates dynamic price when no fixed price', async () => {
      const mockOpenDay = {
        id: 1,
        date: new Date('2024-01-01'),
        fixedPrice: null,
        notes: null
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      const price = await priceService.getPriceForDate(new Date('2024-01-01'));
      
      expect(price).toBeGreaterThan(0);
      expect(typeof price).toBe('number');
    });
  });

  describe('calculateDynamicPrice', () => {
    it('calculates base price for low season', () => {
      const date = new Date('2024-07-15'); // Julio (temporada baja)
      const price = priceService.calculateDynamicPrice(date);
      
      expect(price).toBe(5000); // Precio base
    });

    it('calculates higher price for high season', () => {
      const date = new Date('2024-12-25'); // Diciembre (temporada alta)
      const price = priceService.calculateDynamicPrice(date);
      
      expect(price).toBeGreaterThan(5000);
    });

    it('applies weekend multiplier', () => {
      const weekday = new Date('2024-07-15'); // Lunes
      const weekend = new Date('2024-07-20'); // Sábado
      
      const weekdayPrice = priceService.calculateDynamicPrice(weekday);
      const weekendPrice = priceService.calculateDynamicPrice(weekend);
      
      expect(weekendPrice).toBeGreaterThan(weekdayPrice);
    });

    it('applies holiday multiplier', () => {
      const regularDay = new Date('2024-05-15'); // Día regular
      const holiday = new Date('2024-05-01'); // Día del Trabajador
      
      const regularPrice = priceService.calculateDynamicPrice(regularDay);
      const holidayPrice = priceService.calculateDynamicPrice(holiday);
      
      expect(holidayPrice).toBeGreaterThan(regularPrice);
    });
  });

  describe('checkIfHoliday', () => {
    it('identifies New Year as holiday', () => {
      const newYear = new Date('2024-01-01');
      const isHoliday = priceService.checkIfHoliday(newYear);
      
      expect(isHoliday).toBe(true);
    });

    it('identifies regular day as not holiday', () => {
      const regularDay = new Date('2024-05-15');
      const isHoliday = priceService.checkIfHoliday(regularDay);
      
      expect(isHoliday).toBe(false);
    });
  });

  describe('isHotelOpen', () => {
    it('returns true when hotel is open', async () => {
      const mockOpenDay = {
        id: 1,
        date: new Date('2024-01-01'),
        fixedPrice: 5000
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      const isOpen = await priceService.isHotelOpen(new Date('2024-01-01'));
      
      expect(isOpen).toBe(true);
    });

    it('returns false when hotel is closed', async () => {
      mockPrisma.openDay.findFirst.mockResolvedValue(null);
      
      const isOpen = await priceService.isHotelOpen(new Date('2024-01-01'));
      
      expect(isOpen).toBe(false);
    });
  });

  describe('getPricesForDateRange', () => {
    it('returns prices for date range', async () => {
      const mockOpenDay = {
        id: 1,
        date: new Date('2024-01-01'),
        fixedPrice: 5000
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');
      
      const prices = await priceService.getPricesForDateRange(startDate, endDate);
      
      expect(prices).toHaveLength(3);
      expect(prices[0].date).toEqual(startDate);
      expect(prices[0].price).toBe(5000);
      expect(prices[0].isOpen).toBe(true);
    });

    it('handles closed days in range', async () => {
      mockPrisma.openDay.findFirst
        .mockResolvedValueOnce({ id: 1, date: new Date('2024-01-01'), fixedPrice: 5000 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2, date: new Date('2024-01-03'), fixedPrice: 6000 });
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');
      
      const prices = await priceService.getPricesForDateRange(startDate, endDate);
      
      expect(prices).toHaveLength(3);
      expect(prices[0].isOpen).toBe(true);
      expect(prices[1].isOpen).toBe(false);
      expect(prices[2].isOpen).toBe(true);
    });
  });

  describe('getPriceStatistics', () => {
    it('calculates statistics for open days', async () => {
      const mockOpenDay = {
        id: 1,
        date: new Date('2024-01-01'),
        fixedPrice: 5000
      };
      
      mockPrisma.openDay.findFirst.mockResolvedValue(mockOpenDay);
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');
      
      const stats = await priceService.getPriceStatistics(startDate, endDate);
      
      expect(stats.totalDays).toBe(3);
      expect(stats.openDays).toBe(3);
      expect(stats.closedDays).toBe(0);
      expect(stats.averagePrice).toBe(5000);
      expect(stats.minPrice).toBe(5000);
      expect(stats.maxPrice).toBe(5000);
      expect(stats.totalRevenue).toBe(15000);
    });

    it('handles all closed days', async () => {
      mockPrisma.openDay.findFirst.mockResolvedValue(null);
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');
      
      const stats = await priceService.getPriceStatistics(startDate, endDate);
      
      expect(stats.totalDays).toBe(3);
      expect(stats.openDays).toBe(0);
      expect(stats.closedDays).toBe(3);
      expect(stats.averagePrice).toBe(0);
      expect(stats.minPrice).toBe(0);
      expect(stats.maxPrice).toBe(0);
      expect(stats.totalRevenue).toBe(0);
    });
  });
}); 