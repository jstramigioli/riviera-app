class DynamicPricingService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Calcula la ocupación real del hotel para una fecha específica
   */
  async calculateRealOccupancy(hotelId, date) {
    try {
      // Obtener todas las habitaciones del hotel
      const totalRooms = await this.prisma.room.count({
        where: {
          roomType: {
            // Asumiendo que las habitaciones están asociadas a tipos de habitación
            // que pertenecen al hotel
          }
        }
      });

      if (totalRooms === 0) {
        return 0.5; // Valor por defecto si no hay habitaciones
      }

      // Obtener reservas activas para esa fecha
      const activeReservations = await this.prisma.reservation.count({
        where: {
          checkIn: {
            lte: date
          },
          checkOut: {
            gt: date
          },
          // Asumiendo que las reservas están asociadas a habitaciones del hotel
        }
      });

      // Calcular porcentaje de ocupación
      const occupancyPercentage = (activeReservations / totalRooms) * 100;
      
      // Normalizar entre 0 y 1
      return Math.max(0, Math.min(1, occupancyPercentage / 100));
    } catch (error) {
      console.error('Error calculando ocupación real:', error);
      return 0.5; // Valor por defecto en caso de error
    }
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

    console.log('=== DEBUG calculateExpectedOccupancyScore ===');
    console.log('Params recibidos:', { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday });
    console.log('Valores por defecto:', { demandIndex, weatherScore, eventImpact });

    // Obtener configuración de precios dinámicos
    const config = await this.prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (!config) {
      console.warn('No se encontró configuración de precios dinámicos para el hotel:', hotelId);
      return 0.5; // Valor por defecto
    }

    console.log('Configuración encontrada:', {
      anticipationMode: config.anticipationMode,
      anticipationMaxDays: config.anticipationMaxDays,
      anticipationWeight: config.anticipationWeight
    });

    // Factor de anticipación (más lejos de la fecha = mayor impacto)
    const anticipationFactor = this.calculateAnticipationFactor(daysUntilDate, config);
    
    console.log('Factor de anticipación calculado:', anticipationFactor);
    
    // Si el factor de anticipación es 0 (ya pasó la fecha), retornar 0
    if (anticipationFactor === 0) {
      console.log('Factor de anticipación es 0, retornando 0');
      return 0;
    }
    
    // Factor de ocupación global - calcular ocupación real
    const realOccupancy = await this.calculateRealOccupancy(hotelId, date);
    const occupancyFactor = realOccupancy;
    
    // Factor de fin de semana - calcular basándose en la configuración del backend
    const weekendDays = config?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
    const isWeekendCalculated = weekendDays.includes(date.getDay());
    const weekendFactor = isWeekendCalculated ? 1 : 0;
    

    
    // Factor de feriado
    const holidayFactor = isHoliday ? 1 : 0;

    console.log('Factores calculados:', {
      anticipationFactor,
      occupancyFactor,
      weekendFactor,
      holidayFactor,
      demandIndex,
      weatherScore,
      eventImpact
    });

    console.log('Pesos de configuración:', {
      anticipationWeight: config.anticipationWeight,
      globalOccupancyWeight: config.globalOccupancyWeight,
      isWeekendWeight: config.isWeekendWeight,
      isHolidayWeight: config.isHolidayWeight,
      demandIndexWeight: config.demandIndexWeight,
      weatherScoreWeight: config.weatherScoreWeight,
      eventImpactWeight: config.eventImpactWeight
    });

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

    console.log('Score calculado:', score);
    console.log('Score normalizado:', Math.max(0, Math.min(1, score)));
    console.log('=== FIN DEBUG ===\n');

    // Normalizar entre 0 y 1
    return Math.max(0, Math.min(1, score));
  }

  calculateAnticipationFactor(daysUntilDate, config) {
    console.log('=== DEBUG calculateAnticipationFactor ===');
    console.log('daysUntilDate:', daysUntilDate);
    console.log('config:', config);
    
    // Si no hay configuración, usar valor por defecto
    if (!config) {
      console.log('No hay configuración, retornando 0.5');
      return 0.5;
    }
    
    const mode = config.anticipationMode || 'ESCALONADO';
    console.log('Modo de anticipación:', mode);
    
    let result;
    if (mode === 'CONTINUO') {
      result = this.calculateContinuousAnticipation(daysUntilDate, config.anticipationMaxDays);
      console.log('Resultado modo continuo:', result);
    } else {
      result = this.calculateSteppedAnticipation(daysUntilDate, config.anticipationSteps);
      console.log('Resultado modo escalonado:', result);
    }
    
    console.log('Factor de anticipación final:', result);
    console.log('=== FIN DEBUG calculateAnticipationFactor ===\n');
    return result;
  }

  calculateContinuousAnticipation(daysUntilDate, maxDays) {
    // Si ya pasó la fecha, retornar 0
    if (daysUntilDate < 0) return 0;
    
    // Si faltan más días que el máximo, retornar 1 (máximo)
    if (daysUntilDate >= maxDays) return 1;
    
    // Cálculo lineal: máximo cuando faltan maxDays, 0 cuando faltan 0 días
    return daysUntilDate / maxDays;
  }

  calculateSteppedAnticipation(daysUntilDate, steps) {
    // Si no hay pasos configurados, usar configuración por defecto
    if (!steps || !Array.isArray(steps) || steps.length < 2) {
      const defaultSteps = [
        { days: 21, weight: 1.0 },
        { days: 14, weight: 0.7 },
        { days: 7, weight: 0.4 },
        { days: 3, weight: 0.2 }
      ];
      return this.calculateFromSteps(daysUntilDate, defaultSteps);
    }
    
    return this.calculateFromSteps(daysUntilDate, steps);
  }

  calculateFromSteps(daysUntilDate, steps) {
    // Ordenar pasos por días (descendente)
    const sortedSteps = [...steps].sort((a, b) => b.days - a.days);
    
    // Si ya pasó la fecha, retornar 0
    if (daysUntilDate < 0) return 0;
    
    // Encontrar el paso apropiado
    for (const step of sortedSteps) {
      if (daysUntilDate >= step.days) {
        return step.weight;
      }
    }
    
    // Si no se encontró ningún paso, retornar 0
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
    // Normalizar la fecha actual a medianoche para evitar problemas de hora
    currentDate.setHours(0, 0, 0, 0);
    
    const rates = [];
    for (let date = new Date(startDate); date <= new Date(endDate); date.setDate(date.getDate() + 1)) {
      // Normalizar la fecha objetivo a medianoche
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const daysUntilDate = Math.ceil((targetDate - currentDate) / (1000 * 60 * 60 * 24));
      
      const openDay = await this.prisma.openDay.findUnique({
        where: { 
          hotelId_date: {
            hotelId,
            date: date
          }
        }
      });
      // Obtener configuración de días de fin de semana
      const config = await this.prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });
      
      // Determinar si es fin de semana según la configuración
      const weekendDays = config?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
      const isWeekend = weekendDays.includes(date.getDay());
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