class DynamicPricingService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Calcula el expectedOccupancyScore basado en múltiples factores
   */
  async calculateExpectedOccupancyScore(params) {
    const {
      date,
      hotelId,
      daysUntilDate,
      currentOccupancy,
      isWeekend,
      isHoliday,
      demandIndex = 0.5,
      weatherScore = 0.5,
      eventImpact = 0.5
    } = params;

    // Obtener configuración de precios dinámicos
    const config = await this.prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (!config) {
      console.warn('No se encontró configuración de precios dinámicos para el hotel:', hotelId);
      return 0.5; // Valor por defecto
    }

    // Factor de anticipación (más cercano a la fecha = mayor impacto)
    const anticipationFactor = this.calculateAnticipationFactor(daysUntilDate, config.anticipationThresholds);
    
    // Factor de ocupación global
    const occupancyFactor = currentOccupancy / 100; // Asumiendo que currentOccupancy es un porcentaje
    
    // Factor de fin de semana
    const weekendFactor = isWeekend ? 1 : 0;
    
    // Factor de feriado
    const holidayFactor = isHoliday ? 1 : 0;

    // Cálculo del score ponderado
    const score = (
      anticipationFactor * config.anticipationWeight +
      occupancyFactor * config.globalOccupancyWeight +
      weekendFactor * config.isWeekendWeight +
      holidayFactor * config.isHolidayWeight +
      demandIndex * config.demandIndexWeight +
      weatherScore * config.weatherScoreWeight +
      eventImpact * config.eventImpactWeight
    );

    // Normalizar entre 0 y 1
    return Math.max(0, Math.min(1, score));
  }

  calculateAnticipationFactor(daysUntilDate, thresholds) {
    if (!thresholds || thresholds.length === 0) return 0.5;
    const sortedThresholds = [...thresholds].sort((a, b) => b - a);
    for (const threshold of sortedThresholds) {
      if (daysUntilDate <= threshold) {
        return 1 - (daysUntilDate / threshold);
      }
    }
    return 0;
  }

  async interpolateBasePrice(date, hotelId) {
    const keyframes = await this.prisma.seasonalKeyframe.findMany({
      where: { hotelId },
      orderBy: { date: 'asc' }
    });
    if (!keyframes || keyframes.length === 0) {
      throw new Error('No se encontraron keyframes estacionales para el hotel');
    }
    if (keyframes.length === 1) {
      return keyframes[0].basePrice;
    }
    const targetDate = new Date(date);
    let beforeKeyframe = null;
    let afterKeyframe = null;
    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = new Date(keyframes[i].date);
      const next = new Date(keyframes[i + 1].date);
      if (targetDate >= current && targetDate <= next) {
        beforeKeyframe = keyframes[i];
        afterKeyframe = keyframes[i + 1];
        break;
      }
    }
    if (!beforeKeyframe || !afterKeyframe) {
      const closest = keyframes.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev.date) - targetDate);
        const currDiff = Math.abs(new Date(curr.date) - targetDate);
        return prevDiff < currDiff ? prev : curr;
      });
      return closest.basePrice;
    }
    const beforeDate = new Date(beforeKeyframe.date);
    const afterDate = new Date(afterKeyframe.date);
    const totalDiff = afterDate - beforeDate;
    const targetDiff = targetDate - beforeDate;
    const ratio = targetDiff / totalDiff;
    return beforeKeyframe.basePrice + (afterKeyframe.basePrice - beforeKeyframe.basePrice) * ratio;
  }

  applyDynamicAdjustment(basePrice, occupancyScore, config) {
    const adjustmentPercentage = (occupancyScore - 0.5) * 2;
    const maxAdjustment = config.maxAdjustmentPercentage;
    const finalAdjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustmentPercentage));
    return basePrice * (1 + finalAdjustment);
  }

  async calculateMealPrices(baseRate, hotelId) {
    const mealRules = await this.prisma.mealPricingRule.findUnique({
      where: { hotelId }
    });
    if (!mealRules) {
      return {
        withBreakfast: Math.round(baseRate * 1.15),
        withHalfBoard: Math.round(baseRate * 1.35)
      };
    }
    let breakfastPrice = baseRate;
    let halfBoardPrice = baseRate;
    if (mealRules.breakfastMode === 'FIXED') {
      breakfastPrice = baseRate + mealRules.breakfastValue;
    } else {
      breakfastPrice = baseRate * (1 + mealRules.breakfastValue);
    }
    if (mealRules.dinnerMode === 'FIXED') {
      halfBoardPrice = breakfastPrice + mealRules.dinnerValue;
    } else {
      halfBoardPrice = breakfastPrice * (1 + mealRules.dinnerValue);
    }
    return {
      withBreakfast: Math.round(breakfastPrice),
      withHalfBoard: Math.round(halfBoardPrice)
    };
  }

  async generateDynamicRates(hotelId, roomTypeId, startDate, endDate) {
    const currentDate = new Date();
    const rates = [];
    for (let date = new Date(startDate); date <= new Date(endDate); date.setDate(date.getDate() + 1)) {
      const daysUntilDate = Math.ceil((date - currentDate) / (1000 * 60 * 60 * 24));
      const openDay = await this.prisma.openDay.findUnique({
        where: { 
          hotelId_date: {
            hotelId,
            date: date
          }
        }
      });
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isHoliday = openDay?.isHoliday || false;
      const baseRate = await this.interpolateBasePrice(date, hotelId);
      const occupancyScore = await this.calculateExpectedOccupancyScore({
        date,
        hotelId,
        daysUntilDate,
        currentOccupancy: 50,
        isWeekend,
        isHoliday
      });
      const config = await this.prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });
      const dynamicRate = config && config.enabled
        ? this.applyDynamicAdjustment(baseRate, occupancyScore, config)
        : baseRate;
      const mealPrices = await this.calculateMealPrices(dynamicRate, hotelId);
      const rate = await this.prisma.dailyRoomRate.upsert({
        where: {
          hotelId_roomTypeId_date: {
            hotelId,
            roomTypeId,
            date
          }
        },
        update: {
          baseRate,
          dynamicRate,
          withBreakfast: mealPrices.withBreakfast,
          withHalfBoard: mealPrices.withHalfBoard
        },
        create: {
          hotelId,
          roomTypeId,
          date,
          baseRate,
          dynamicRate,
          withBreakfast: mealPrices.withBreakfast,
          withHalfBoard: mealPrices.withHalfBoard
        }
      });
      rates.push(rate);
    }
    return rates;
  }

  async getRatesForDateRange(hotelId, roomTypeId, startDate, endDate) {
    return await this.prisma.dailyRoomRate.findMany({
      where: {
        hotelId,
        roomTypeId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      orderBy: { date: 'asc' }
    });
  }

  async applyGapPromotion(roomId, date, discountRate) {
    return await this.prisma.roomGapPromotion.create({
      data: {
        roomId,
        date,
        discountRate
      }
    });
  }

  async getGapPromotions(roomId, date) {
    return await this.prisma.roomGapPromotion.findMany({
      where: {
        roomId,
        date
      }
    });
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = new DynamicPricingService(prisma);
module.exports.DynamicPricingService = DynamicPricingService; 