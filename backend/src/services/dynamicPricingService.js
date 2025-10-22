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

      // Obtener segmentos de reserva activos para esa fecha
      const activeReservations = await this.prisma.reservationSegment.count({
        where: {
          startDate: {
            lte: date
          },
          endDate: {
            gt: date
          },
          isActive: true
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
   * Función para detectar si una fecha es parte de un feriado/fin de semana largo
   */
  async isLongWeekendOrHoliday(date, hotelId) {
    try {
      // Obtener todos los feriados del hotel
      const holidays = await this.prisma.openDay.findMany({
        where: {
          hotelId,
          isHoliday: true
        },
        orderBy: { date: 'asc' }
      });

      // Convertir fechas de feriados a objetos Date para comparación
      const holidayDates = holidays.map(h => new Date(h.date));
      
      // Verificar si la fecha actual es feriado
      const currentDate = new Date(date);
      const isCurrentDateHoliday = holidayDates.some(h => 
        h.getFullYear() === currentDate.getFullYear() &&
        h.getMonth() === currentDate.getMonth() &&
        h.getDate() === currentDate.getDate()
      );

      // Si la fecha actual es feriado, es parte de un fin de semana largo
      if (isCurrentDateHoliday) {
        return true;
      }

      // Verificar si es sábado o domingo (fin de semana estándar)
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6; // 0 = domingo, 6 = sábado
      
      if (!isWeekend) {
        return false; // No es fin de semana ni feriado
      }

      // Si es fin de semana, verificar si hay feriados adyacentes
      // Buscar feriados en los días anteriores y posteriores
      const adjacentDays = [];
      
      // Agregar días anteriores (hasta 3 días antes)
      for (let i = 1; i <= 3; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - i);
        adjacentDays.push(prevDate);
      }
      
      // Agregar días posteriores (hasta 3 días después)
      for (let i = 1; i <= 3; i++) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + i);
        adjacentDays.push(nextDate);
      }

      // Verificar si alguno de los días adyacentes es feriado
      const hasAdjacentHoliday = adjacentDays.some(adjDate => 
        holidayDates.some(h => 
          h.getFullYear() === adjDate.getFullYear() &&
          h.getMonth() === adjDate.getMonth() &&
          h.getDate() === adjDate.getDate()
        )
      );

      return hasAdjacentHoliday;
    } catch (error) {
      console.error('Error verificando feriado/fin de semana largo:', error);
      return false;
    }
  }

  /**
   * Calcula el expectedOccupancyScore basado en múltiples factores
   * @deprecated Este método se mantiene por compatibilidad pero se recomienda usar calculateIndividualAdjustmentPercentages
   */
  async calculateExpectedOccupancyScore(params) {
    const {
      date,
      hotelId,
      daysUntilDate,
      currentOccupancy,
      isWeekend,
      isHoliday,
      weatherScore = 0.5,
      eventImpact = 0.5
    } = params;

    // console.log('=== DEBUG calculateExpectedOccupancyScore (DEPRECATED) ===');
    // console.log('Params recibidos:', { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday });
    // console.log('Valores por defecto:', { weatherScore, eventImpact });

    // Obtener configuración de precios dinámicos
    const config = await this.prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (!config) {
      console.warn('No se encontró configuración de precios dinámicos para el hotel:', hotelId);
      return 0.5; // Valor por defecto
    }

    // console.log('Configuración encontrada:', {
    //   anticipationMode: config.anticipationMode,
    //   anticipationMaxDays: config.anticipationMaxDays,
    //   anticipationWeight: config.anticipationWeight
    // });

    // Factor de anticipación (más lejos de la fecha = mayor impacto)
    const anticipationFactor = await this.calculateAnticipationFactor(daysUntilDate, config);
    
    // console.log('Factor de anticipación calculado:', anticipationFactor);
    
    // Si el factor de anticipación es 0 (ya pasó la fecha), retornar 0
    if (anticipationFactor === 0) {
      // console.log('Factor de anticipación es 0, retornando 0');
      return 0;
    }
    
    // Factor de ocupación global - calcular ocupación real
    const realOccupancy = await this.calculateRealOccupancy(hotelId, date);
    const occupancyFactor = realOccupancy;
    
    // Factor de fin de semana - calcular basándose en la configuración del backend
    const weekendDays = config?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
    const isWeekendCalculated = weekendDays.includes(date.getDay());
    const weekendFactor = isWeekendCalculated ? 1 : 0;
    
    // Factor de feriado/fin de semana largo - nueva lógica
    const isLongWeekendOrHoliday = await this.isLongWeekendOrHoliday(date, hotelId);
    const holidayFactor = isLongWeekendOrHoliday ? 1 : 0;

    // console.log('Factores calculados:', {
    //   anticipationFactor,
    //   occupancyFactor,
    //   weekendFactor,
    //   holidayFactor,
    //   weatherScore,
    //   eventImpact
    // });

    // console.log('Pesos de configuración:', {
    //   anticipationWeight: config.anticipationWeight,
    //   globalOccupancyWeight: config.globalOccupancyWeight,
    //   isWeekendWeight: config.isWeekendWeight,
    //   isHolidayWeight: config.isHolidayWeight,
    //   weatherScoreWeight: config.weatherScoreWeight,
    //   eventImpactWeight: config.eventImpactWeight
    // });

    // Cálculo del score ponderado
    const score = (
      anticipationFactor * config.anticipationWeight +
      occupancyFactor * config.globalOccupancyWeight +
      weekendFactor * config.isWeekendWeight +
      holidayFactor * config.isHolidayWeight +
      weatherScore * config.weatherScoreWeight +
      eventImpact * config.eventImpactWeight
    );

    // console.log('Score calculado:', score);
    // console.log('Score normalizado:', Math.max(0, Math.min(1, score)));
    // console.log('=== FIN DEBUG ===\n');

    // Normalizar entre 0 y 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula los porcentajes de ajuste individuales para cada factor
   * @param {Object} params - Parámetros de cálculo
   * @returns {Object} - Porcentajes de ajuste por factor
   */
  async calculateIndividualAdjustmentPercentages(params) {
    const {
      date,
      hotelId,
      daysUntilDate,
      currentOccupancy,
      isWeekend,
      isHoliday,
      weatherScore = 0.5,
      eventImpact = 0.5
    } = params;

    // console.log('=== DEBUG calculateIndividualAdjustmentPercentages ===');
    // console.log('Params recibidos:', { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday });

    // Obtener configuración de precios dinámicos
    const config = await this.prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (!config) {
      console.warn('No se encontró configuración de precios dinámicos para el hotel:', hotelId);
      return {
        occupancyAdjustment: 0,
        anticipationAdjustment: 0,
        weekendAdjustment: 0,
        holidayAdjustment: 0,
        totalAdjustment: 0
      };
    }

    // console.log('Configuración encontrada:', {
    //   standardRate: config.standardRate,
    //   idealOccupancy: config.idealOccupancy,
    //   occupancyAdjustmentPercentage: config.occupancyAdjustmentPercentage,
    //   anticipationAdjustmentPercentage: config.anticipationAdjustmentPercentage,
    //   weekendAdjustmentPercentage: config.weekendAdjustmentPercentage,
    //   holidayAdjustmentPercentage: config.holidayAdjustmentPercentage
    // });

    // 1. Cálculo del ajuste por ocupación
    const occupancyAdjustment = this.calculateOccupancyAdjustment(
      currentOccupancy, 
      config.idealOccupancy, 
      config.occupancyAdjustmentPercentage
    );

    // 2. Cálculo del ajuste por anticipación
    const anticipationFactor = await this.calculateAnticipationFactor(daysUntilDate, config);
    const anticipationAdjustment = this.calculateAnticipationAdjustment(
      anticipationFactor,
      config.anticipationAdjustmentPercentage
    );

    // 3. Cálculo del ajuste por fin de semana
    const weekendDays = config?.weekendDays || [0, 6];
    const isWeekendCalculated = weekendDays.includes(date.getDay());
    const weekendAdjustment = this.calculateWeekendAdjustment(
      isWeekendCalculated,
      config.weekendAdjustmentPercentage
    );

    // 4. Cálculo del ajuste por feriados
    const isLongWeekendOrHoliday = await this.isLongWeekendOrHoliday(date, hotelId);
    const holidayAdjustment = this.calculateHolidayAdjustment(
      isLongWeekendOrHoliday,
      config.holidayAdjustmentPercentage
    );

    // 5. Cálculo del ajuste total
    const totalAdjustment = occupancyAdjustment + anticipationAdjustment + weekendAdjustment + holidayAdjustment;

    // console.log('Ajustes calculados:', {
    //   occupancyAdjustment,
    //   anticipationAdjustment,
    //   weekendAdjustment,
    //   holidayAdjustment,
    //   totalAdjustment
    // });

    // console.log('=== FIN DEBUG calculateIndividualAdjustmentPercentages ===\n');

    return {
      occupancyAdjustment,
      anticipationAdjustment,
      weekendAdjustment,
      holidayAdjustment,
      totalAdjustment
    };
  }

  /**
   * Calcula el ajuste por ocupación basado en la diferencia con la ocupación ideal
   */
  calculateOccupancyAdjustment(currentOccupancy, idealOccupancy, maxAdjustmentPercentage) {
    // Convertir ocupación actual a porcentaje si viene como decimal
    const occupancyPercent = currentOccupancy <= 1 ? currentOccupancy * 100 : currentOccupancy;
    
    // Calcular delta según la fórmula especificada
    const delta = (occupancyPercent - idealOccupancy) / (100 - idealOccupancy);
    
    // Aplicar el porcentaje máximo de ajuste
    const adjustment = delta * (maxAdjustmentPercentage / 100);
    
    // console.log('Cálculo ocupación:', {
    //   occupancyPercent,
    //   idealOccupancy,
    //   delta,
    //   maxAdjustmentPercentage,
    //   adjustment
    // });
    
    return adjustment;
  }

  /**
   * Calcula el ajuste por anticipación
   */
  calculateAnticipationAdjustment(anticipationFactor, maxAdjustmentPercentage) {
    // Asegurar que anticipationFactor sea un número
    const factor = typeof anticipationFactor === 'object' && anticipationFactor.then 
      ? 0.5 // Valor por defecto si es una Promise
      : anticipationFactor;
    
    // El factor de anticipación ya está entre 0 y 1
    // Convertirlo a un ajuste que puede ser positivo o negativo
    const adjustment = (factor - 0.5) * 2 * (maxAdjustmentPercentage / 100);
    
    // console.log('Cálculo anticipación:', {
    //   anticipationFactor: factor,
    //   maxAdjustmentPercentage,
    //   adjustment
    // });
    
    return adjustment;
  }

  /**
   * Calcula el ajuste por fin de semana
   */
  calculateWeekendAdjustment(isWeekend, maxAdjustmentPercentage) {
    // Si es fin de semana, aplicar el ajuste máximo positivo
    const adjustment = isWeekend ? (maxAdjustmentPercentage / 100) : 0;
    
    // console.log('Cálculo fin de semana:', {
    //   isWeekend,
    //   maxAdjustmentPercentage,
    //   adjustment
    // });
    
    return adjustment;
  }

  /**
   * Calcula el ajuste por feriados
   */
  calculateHolidayAdjustment(isHoliday, maxAdjustmentPercentage) {
    // Si es feriado, aplicar el ajuste máximo positivo
    const adjustment = isHoliday ? (maxAdjustmentPercentage / 100) : 0;
    
    // console.log('Cálculo feriado:', {
    //   isHoliday,
    //   maxAdjustmentPercentage,
    //   adjustment
    // });
    
    return adjustment;
  }

  /**
   * Aplica el ajuste dinámico usando el nuevo sistema de porcentajes individuales
   */
  applyDynamicAdjustment(basePrice, adjustmentPercentages, config) {
    const { totalAdjustment } = adjustmentPercentages;
    
    // Aplicar el ajuste total directamente sin límites globales
    // Los límites se pueden aplicar en el frontend si es necesario
    const finalPrice = basePrice * (1 + totalAdjustment);
    
    // console.log('Aplicando ajuste dinámico:', {
    //   basePrice,
    //   totalAdjustment,
    //   finalPrice
    // });
    
    return finalPrice;
  }

  async calculateAnticipationFactor(daysUntilDate, config) {
    // console.log('=== DEBUG calculateAnticipationFactor ===');
    // console.log('daysUntilDate:', daysUntilDate);
    // console.log('config:', config);
    
    // Si no hay configuración, usar valor por defecto
    if (!config) {
      // console.log('No hay configuración, retornando 0.5');
      return 0.5;
    }
    
    const mode = config.anticipationMode || 'ESCALONADO';
    // console.log('Modo de anticipación:', mode);
    
    let result;
    if (mode === 'CONTINUO') {
      result = this.calculateContinuousAnticipation(daysUntilDate, config.anticipationMaxDays);
      // console.log('Resultado modo continuo:', result);
    } else {
      result = this.calculateSteppedAnticipation(daysUntilDate, config.anticipationSteps);
      // console.log('Resultado modo escalonado:', result);
    }
    
    // console.log('Factor de anticipación final:', result);
    // console.log('=== FIN DEBUG calculateAnticipationFactor ===\n');
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

  async interpolateBasePrice(date, hotelId, roomTypeId = null) {
    // Buscar bloque de temporada activo para la fecha
    const targetDate = new Date(date);
    
    const seasonBlock = await this.prisma.seasonBlock.findFirst({
      where: {
        hotelId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
        isDraft: false
      },
      include: {
        seasonPrices: true
      }
    });
    
    if (!seasonBlock) {
      throw new Error('No hay precios configurados para las fechas solicitadas. Por favor, configure bloques de temporada con precios válidos.');
    }
    
    // Si se especifica un roomTypeId, buscar el precio específico para ese tipo de habitación
    if (roomTypeId && seasonBlock.seasonPrices && seasonBlock.seasonPrices.length > 0) {
      const roomTypePrice = seasonBlock.seasonPrices.find(price => price.roomTypeId === roomTypeId);
      if (roomTypePrice) {
        return roomTypePrice.basePrice;
      }
    }
    
    // Si no se encuentra precio específico, usar el primer precio como referencia
    if (seasonBlock.seasonPrices && seasonBlock.seasonPrices.length > 0) {
      return seasonBlock.seasonPrices[0].basePrice;
    }
    
    // Si no hay precios específicos por tipo de habitación, usar precio base por defecto
    return 100; // Precio base por defecto
  }

  async calculateMealPrices(baseRate, hotelId) {
    try {
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
    } catch (error) {
      console.error('Error en calculateMealPrices, usando valores por defecto:', error);
      // Usar valores por defecto si hay error
      return {
        withBreakfast: Math.round(baseRate * 1.15),
        withHalfBoard: Math.round(baseRate * 1.35)
      };
    }
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
      
      // Buscar el día de apertura usando el mismo formato que se usa para guardar
      const dateString = date.toISOString().split('T')[0]; // Obtener YYYY-MM-DD
      const searchDate = new Date(dateString + 'T00:00:00');
      
      let openDay = await this.prisma.openDay.findUnique({
        where: { 
          hotelId_date: {
            hotelId,
            date: searchDate
          }
        }
      });
      
      // Si no se encuentra, buscar por rango de fechas para manejar problemas de zona horaria
      if (!openDay) {
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        openDay = await this.prisma.openDay.findFirst({
          where: {
            hotelId,
            date: {
              gte: startOfDay,
              lt: endOfDay
            }
          }
        });
      }
      // Obtener configuración de días de fin de semana
      const config = await this.prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });
      
      // Determinar si es fin de semana según la configuración
      const weekendDays = config?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
      const isWeekend = weekendDays.includes(date.getDay());
      const baseRate = await this.interpolateBasePrice(date, hotelId, roomTypeId);
      const occupancyScore = await this.calculateRealOccupancy(hotelId, date); // Usar calculateRealOccupancy
      const adjustmentPercentages = await this.calculateIndividualAdjustmentPercentages({
        date,
        hotelId,
        daysUntilDate,
        currentOccupancy: occupancyScore,
        isWeekend,
        isHoliday: false // Ya no se usa, la nueva lógica maneja esto internamente
      });
      const dynamicRate = config && config.enabled
        ? this.applyDynamicAdjustment(baseRate, adjustmentPercentages, config)
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
          dynamicRate
        },
        create: {
          hotelId,
          roomTypeId,
          date,
          baseRate,
          dynamicRate
        }
      });
      rates.push(rate);
    }
    return rates;
  }

  async getRatesForDateRange(hotelId, roomTypeId, startDate, endDate) {
    // Incluir todas las fechas desde el check-in hasta el día anterior al check-out
    // Esto significa que para una reserva del 10/10 al 13/10, incluimos 10/10, 11/10 y 12/10
    const endDateExclusive = new Date(endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() - 1);
    
    return await this.prisma.dailyRoomRate.findMany({
      where: {
        hotelId,
        roomTypeId,
        date: {
          gte: new Date(startDate),
          lte: endDateExclusive
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