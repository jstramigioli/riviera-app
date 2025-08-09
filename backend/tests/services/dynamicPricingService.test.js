jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    dynamicPricingConfig: {
      findUnique: jest.fn()
    },
    seasonalKeyframe: {
      findMany: jest.fn()
    },
    dailyRoomRate: {
      upsert: jest.fn(),
      findMany: jest.fn()
    },
    roomGapPromotion: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    mealPricingRule: {
      findUnique: jest.fn()
    },
    openDay: {
      findUnique: jest.fn()
    }
  }))
}));

const { DynamicPricingService } = require('../../src/services/dynamicPricingService');
const { PrismaClient } = require('@prisma/client');
const mockPrisma = new PrismaClient();
const dynamicPricingService = new DynamicPricingService(mockPrisma);

describe('DynamicPricingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateExpectedOccupancyScore', () => {
    it('should calculate score with default values when no config exists', async () => {
      mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(null);

      const score = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(),
        hotelId: 'test-hotel',
        daysUntilDate: 10,
        currentOccupancy: 50,
        isWeekend: false,
        isHoliday: false
      });

      expect(score).toBe(0.5);
    });

    it('should calculate score with configuration', async () => {
      const mockConfig = {
        anticipationThresholds: [21, 14, 7, 3],
        anticipationWeight: 0.3,
        globalOccupancyWeight: 0.25,
        isWeekendWeight: 0.15,
        isHolidayWeight: 0.1,
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.05,
        maxAdjustmentPercentage: 0.4
      };

      mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue(mockConfig);

      const score = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(),
        hotelId: 'test-hotel',
        daysUntilDate: 5,
        currentOccupancy: 80,
        isWeekend: true,
        isHoliday: false,
        weatherScore: 0.9,
        eventImpact: 0.7
      });

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateAnticipationFactor', () => {
    it('should return 0.5 when no config provided', () => {
      const factor = dynamicPricingService.calculateAnticipationFactor(10, null);
      expect(factor).toBe(0.5);
    });

    it('should calculate factor based on days until date with CONTINUO mode', () => {
      const config = {
        anticipationMode: 'CONTINUO',
        anticipationMaxDays: 30
      };
      
      // Test with 15 days (should be 0.5 since it's half of maxDays)
      const factor1 = dynamicPricingService.calculateAnticipationFactor(15, config);
      expect(factor1).toBe(0.5);

      // Test with 30 days (should be 1.0 since it's maxDays)
      const factor2 = dynamicPricingService.calculateAnticipationFactor(30, config);
      expect(factor2).toBe(1.0);
    });

    it('should calculate factor with ESCALONADO mode', () => {
      const config = {
        anticipationMode: 'ESCALONADO',
        anticipationSteps: [
          { days: 21, weight: 1.0 },
          { days: 14, weight: 0.7 },
          { days: 7, weight: 0.4 },
          { days: 3, weight: 0.2 }
        ]
      };
      
      // Test with 10 days (should use step 7 days with weight 0.4)
      const factor = dynamicPricingService.calculateAnticipationFactor(10, config);
      expect(factor).toBe(0.4);
    });
  });

  describe('interpolateBasePrice', () => {
    it('should return price from active season block', async () => {
      const mockSeasonBlock = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        roomTypePrices: [
          { basePrice: 10000 }
        ]
      };

      mockPrisma.seasonBlock.findFirst.mockResolvedValue(mockSeasonBlock);

      const price = await dynamicPricingService.interpolateBasePrice(
        new Date('2024-01-15'),
        'test-hotel'
      );

      expect(price).toBe(10000);
    });

    it('should throw error when no season block found', async () => {
      mockPrisma.seasonBlock.findFirst.mockResolvedValue(null);

      await expect(
        dynamicPricingService.interpolateBasePrice(
          new Date('2024-01-15'),
          'test-hotel'
        )
      ).rejects.toThrow('No se encontró un bloque de temporada para la fecha especificada');
    });

    it('should return default price when no room type prices', async () => {
      const mockSeasonBlock = {
        id: 1,
        hotelId: 'test-hotel',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        roomTypePrices: []
      };

      mockPrisma.seasonBlock.findFirst.mockResolvedValue(mockSeasonBlock);

      const price = await dynamicPricingService.interpolateBasePrice(
        new Date('2024-01-15'),
        'test-hotel'
      );

      expect(price).toBe(100);
    });
  });

  describe('applyDynamicAdjustment', () => {
    it('should apply positive adjustment for high occupancy score', () => {
      const basePrice = 10000;
      const occupancyScore = 0.8;
      const config = { maxAdjustmentPercentage: 0.4 };

      const adjustedPrice = dynamicPricingService.applyDynamicAdjustment(
        basePrice,
        occupancyScore,
        config
      );

      expect(adjustedPrice).toBeGreaterThan(basePrice);
    });

    it('should apply negative adjustment for low occupancy score', () => {
      const basePrice = 10000;
      const occupancyScore = 0.2;
      const config = { maxAdjustmentPercentage: 0.4 };

      const adjustedPrice = dynamicPricingService.applyDynamicAdjustment(
        basePrice,
        occupancyScore,
        config
      );

      expect(adjustedPrice).toBeLessThan(basePrice);
    });

    it('should respect maximum adjustment limit', () => {
      const basePrice = 10000;
      const occupancyScore = 1.0; // Maximum score
      const config = { maxAdjustmentPercentage: 0.4 };

      const adjustedPrice = dynamicPricingService.applyDynamicAdjustment(
        basePrice,
        occupancyScore,
        config
      );

      // Should not exceed 40% increase
      expect(adjustedPrice).toBeLessThanOrEqual(basePrice * 1.4);
    });
  });

  describe('calculateMealPrices', () => {
    it('should use default values when no meal rules exist', async () => {
      mockPrisma.mealPricingRule.findUnique.mockResolvedValue(null);

      const mealPrices = await dynamicPricingService.calculateMealPrices(10000, 'test-hotel');

      expect(mealPrices.withBreakfast).toBe(Math.round(11500)); // 15% more
      expect(mealPrices.withHalfBoard).toBe(Math.round(13500)); // 35% more
    });

    it('should calculate prices with percentage rules', async () => {
      const mockRules = {
        breakfastMode: 'PERCENTAGE',
        breakfastValue: 0.15,
        dinnerMode: 'PERCENTAGE',
        dinnerValue: 0.20
      };

      mockPrisma.mealPricingRule.findUnique.mockResolvedValue(mockRules);

      const mealPrices = await dynamicPricingService.calculateMealPrices(10000, 'test-hotel');

      expect(mealPrices.withBreakfast).toBe(Math.round(11500)); // 10000 * 1.15
      expect(mealPrices.withHalfBoard).toBe(Math.round(13800)); // 11500 * 1.20
    });

    it('should calculate prices with fixed rules', async () => {
      const mockRules = {
        breakfastMode: 'FIXED',
        breakfastValue: 2000,
        dinnerMode: 'FIXED',
        dinnerValue: 3000
      };

      mockPrisma.mealPricingRule.findUnique.mockResolvedValue(mockRules);

      const mealPrices = await dynamicPricingService.calculateMealPrices(10000, 'test-hotel');

      expect(mealPrices.withBreakfast).toBe(Math.round(12000)); // 10000 + 2000
      expect(mealPrices.withHalfBoard).toBe(Math.round(15000)); // 12000 + 3000
    });
  });

  describe('generateDynamicRates', () => {
    it('should generate rates for date range', async () => {
      // Mock all dependencies
      mockPrisma.openDay.findUnique.mockResolvedValue({ isHoliday: false });
      mockPrisma.dynamicPricingConfig.findUnique.mockResolvedValue({
        maxAdjustmentPercentage: 0.4
      });
      mockPrisma.seasonalKeyframe.findMany.mockResolvedValue([
        { date: new Date('2024-01-15'), basePrice: 10000 }
      ]);
      mockPrisma.mealPricingRule.findUnique.mockResolvedValue({
        breakfastMode: 'PERCENTAGE',
        breakfastValue: 0.15,
        dinnerMode: 'PERCENTAGE',
        dinnerValue: 0.20
      });
      mockPrisma.dailyRoomRate.upsert.mockResolvedValue({
        id: 'test-rate',
        baseRate: 10000,
        dynamicRate: 10500,
        withBreakfast: 11500,
        withHalfBoard: 13800
      });

      const rates = await dynamicPricingService.generateDynamicRates(
        'test-hotel',
        1,
        new Date('2024-01-01'),
        new Date('2024-01-03')
      );

      expect(rates).toHaveLength(3);
      expect(mockPrisma.dailyRoomRate.upsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('getRatesForDateRange', () => {
    it('should return rates for date range', async () => {
      const mockRates = [
        { id: 'rate1', date: new Date('2024-01-01'), baseRate: 10000 },
        { id: 'rate2', date: new Date('2024-01-02'), baseRate: 10500 }
      ];

      mockPrisma.dailyRoomRate.findMany.mockResolvedValue(mockRates);

      const rates = await dynamicPricingService.getRatesForDateRange(
        'test-hotel',
        1,
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(rates).toEqual(mockRates);
    });
  });

  describe('applyGapPromotion', () => {
    it('should create gap promotion', async () => {
      const mockPromotion = {
        id: 'promo1',
        roomId: 1,
        date: new Date('2024-01-01'),
        discountRate: 0.15
      };

      mockPrisma.roomGapPromotion.create.mockResolvedValue(mockPromotion);

      const promotion = await dynamicPricingService.applyGapPromotion(
        1,
        new Date('2024-01-01'),
        0.15
      );

      expect(promotion).toEqual(mockPromotion);
    });
  });

  describe('getGapPromotions', () => {
    it('should return gap promotions for room and date', async () => {
      const mockPromotions = [
        { id: 'promo1', roomId: 1, date: new Date('2024-01-01'), discountRate: 0.15 }
      ];

      mockPrisma.roomGapPromotion.findMany.mockResolvedValue(mockPromotions);

      const promotions = await dynamicPricingService.getGapPromotions(
        1,
        new Date('2024-01-01')
      );

      expect(promotions).toEqual(mockPromotions);
    });
  });
}); 