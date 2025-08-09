const dynamicPricingService = require('../services/dynamicPricingService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DynamicPricingController {
  /**
   * Obtener configuración de precios dinámicos
   */
  async getDynamicPricingConfig(req, res) {
    try {
      const { hotelId } = req.params;
      
      const config = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      if (!config) {
        return res.status(404).json({ message: 'Configuración no encontrada' });
      }

      res.json(config);
    } catch (error) {
      console.error('Error al obtener configuración de precios dinámicos:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear o actualizar configuración de precios dinámicos
   */
  async upsertDynamicPricingConfig(req, res) {
    try {
      const { hotelId } = req.params;
      const configData = req.body;



      // Primero verificar si existe la configuración
      const existingConfig = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      let config;
      if (existingConfig) {
        // Si existe, actualizar
        config = await prisma.dynamicPricingConfig.update({
          where: { hotelId },
          data: configData
        });
      } else {
        // Si no existe, crear con valores por defecto
        const defaultConfig = {
          enabled: false,
          anticipationWeight: 0.2,
          globalOccupancyWeight: 0.25,
          isWeekendWeight: 0.15,
          weekendDays: [0, 6],
          isHolidayWeight: 0.1,
          weatherScoreWeight: 0.05,
          eventImpactWeight: 0.1,
          maxAdjustmentPercentage: 0.4,
          enableGapPromos: true,
          enableWeatherApi: false,
          enableRecentDemand: false,
          anticipationMode: 'ESCALONADO',
          anticipationMaxDays: 30,
          anticipationSteps: [
            { days: 21, weight: 1.0 },
            { days: 14, weight: 0.7 },
            { days: 7, weight: 0.4 },
            { days: 3, weight: 0.2 }
          ],
          // Nuevos campos para porcentajes individuales
          standardRate: configData.standardRate || null,
          idealOccupancy: configData.idealOccupancy || 80.0,
          occupancyAdjustmentPercentage: configData.occupancyAdjustmentPercentage || 20.0,
          anticipationAdjustmentPercentage: configData.anticipationAdjustmentPercentage || 15.0,
          weekendAdjustmentPercentage: configData.weekendAdjustmentPercentage || 10.0,
          holidayAdjustmentPercentage: configData.holidayAdjustmentPercentage || 25.0,
          
          // Estado de activación de factores
          occupancyEnabled: configData.occupancyEnabled !== undefined ? configData.occupancyEnabled : true,
          anticipationEnabled: configData.anticipationEnabled !== undefined ? configData.anticipationEnabled : true,
          weekendEnabled: configData.weekendEnabled !== undefined ? configData.weekendEnabled : true,
          holidayEnabled: configData.holidayEnabled !== undefined ? configData.holidayEnabled : true,
          ...configData
        };
        
        config = await prisma.dynamicPricingConfig.create({
          data: {
            hotelId,
            ...defaultConfig
          }
        });
      }


      res.json(config);
    } catch (error) {
      console.error('Error al crear/actualizar configuración de precios dinámicos:', error);

      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener keyframes estacionales
   */
  async getSeasonalKeyframes(req, res) {
    try {
      const { hotelId } = req.params;

      const keyframes = await prisma.seasonalKeyframe.findMany({
        where: { hotelId },
        orderBy: { date: 'asc' }
      });

      res.json(keyframes);
    } catch (error) {
      console.error('Error al obtener keyframes estacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear keyframe estacional
   */
  async createSeasonalKeyframe(req, res) {
    try {
      const { hotelId } = req.params;
      const { date, basePrice, isOperational, operationalType, periodId } = req.body;

      // Verificar si ya existe un keyframe para esta fecha
      const existingKeyframe = await prisma.seasonalKeyframe.findFirst({
        where: {
          hotelId,
          date: new Date(date)
        }
      });

      if (existingKeyframe) {
        // Si es un keyframe operacional, no permitir sobrescribirlo
        if (existingKeyframe.isOperational) {
          return res.status(409).json({ 
            message: 'No se puede crear un keyframe en esta fecha porque ya existe un keyframe operacional (apertura/cierre)' 
          });
        }
        
        return res.status(409).json({ 
          message: 'Ya existe un keyframe para esta fecha' 
        });
      }

      // Si no es un keyframe operacional, validar que esté dentro de un período de apertura
      if (!isOperational) {
        const targetDate = new Date(date);
        
        // Buscar períodos operacionales que contengan esta fecha
        const operationalPeriods = await prisma.operationalPeriod.findMany({
          where: {
            hotelId,
            startDate: { lte: targetDate },
            endDate: { gte: targetDate }
          }
        });

        if (operationalPeriods.length === 0) {
          return res.status(400).json({
            message: 'No se puede crear un keyframe fuera de un período de apertura. La fecha debe estar dentro de un período operacional.'
          });
        }
      }

      const keyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date(date),
          basePrice: parseFloat(basePrice),
          isOperational: isOperational || false,
          operationalType: operationalType || null,
          periodId: periodId || null
        }
      });

      res.status(201).json(keyframe);
    } catch (error) {
      console.error('Error al crear keyframe:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Crear keyframes operacionales para un período
  async createOperationalKeyframes(req, res) {
    try {
      const { hotelId } = req.params;
      const { periodId, startDate, endDate, basePrice = 0 } = req.body;

      // Crear keyframe de apertura
      const openingKeyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date(startDate),
          basePrice: parseFloat(basePrice),
          isOperational: true,
          operationalType: 'opening',
          periodId
        }
      });

      // Crear keyframe de cierre
      const closingKeyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date(endDate),
          basePrice: parseFloat(basePrice),
          isOperational: true,
          operationalType: 'closing',
          periodId
        }
      });

      res.status(201).json({
        opening: openingKeyframe,
        closing: closingKeyframe
      });
    } catch (error) {
      console.error('Error al crear keyframes operacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Actualizar keyframes operacionales cuando cambia un período
  async updateOperationalKeyframes(req, res) {
    try {
      const { periodId } = req.params;
      const { startDate, endDate, basePrice } = req.body;

      // Buscar keyframes existentes para este período
      const existingKeyframes = await prisma.seasonalKeyframe.findMany({
        where: {
          periodId,
          isOperational: true
        }
      });

      // Actualizar keyframe de apertura
      const openingKeyframe = existingKeyframes.find(k => k.operationalType === 'opening');
      if (openingKeyframe) {
        await prisma.seasonalKeyframe.update({
          where: { id: openingKeyframe.id },
          data: {
            date: new Date(startDate),
            basePrice: parseFloat(basePrice || openingKeyframe.basePrice)
          }
        });
      }

      // Actualizar keyframe de cierre
      const closingKeyframe = existingKeyframes.find(k => k.operationalType === 'closing');
      if (closingKeyframe) {
        await prisma.seasonalKeyframe.update({
          where: { id: closingKeyframe.id },
          data: {
            date: new Date(endDate),
            basePrice: parseFloat(basePrice || closingKeyframe.basePrice)
          }
        });
      }

      res.json({ message: 'Keyframes operacionales actualizados' });
    } catch (error) {
      console.error('Error al actualizar keyframes operacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Eliminar keyframes operacionales cuando se elimina un período
  async deleteOperationalKeyframes(req, res) {
    try {
      const { periodId } = req.params;

      await prisma.seasonalKeyframe.deleteMany({
        where: {
          periodId,
          isOperational: true
        }
      });

      res.json({ message: 'Keyframes operacionales eliminados' });
    } catch (error) {
      console.error('Error al eliminar keyframes operacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar precio de keyframe operacional
   */
  async updateOperationalKeyframePrice(req, res) {
    try {
      const { id } = req.params;
      const { basePrice } = req.body;

      // Verificar si el keyframe existe y es operacional
      const existingKeyframe = await prisma.seasonalKeyframe.findUnique({
        where: { id }
      });

      if (!existingKeyframe) {
        return res.status(404).json({ message: 'Keyframe no encontrado' });
      }

      if (!existingKeyframe.isOperational) {
        return res.status(400).json({ 
          message: 'Este keyframe no es operacional' 
        });
      }

      // Solo actualizar el precio
      const keyframe = await prisma.seasonalKeyframe.update({
        where: { id },
        data: {
          basePrice: parseFloat(basePrice)
        }
      });

      res.json(keyframe);
    } catch (error) {
      console.error('Error al actualizar precio de keyframe operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar keyframe estacional
   */
  async updateSeasonalKeyframe(req, res) {
    try {
      const { id } = req.params;
      const { date, basePrice } = req.body;

      // Verificar si el keyframe existe
      const existingKeyframe = await prisma.seasonalKeyframe.findUnique({
        where: { id }
      });

      if (!existingKeyframe) {
        return res.status(404).json({ message: 'Keyframe no encontrado' });
      }

      // Si es un keyframe operacional, solo permitir actualizar el precio
      if (existingKeyframe.isOperational) {
        // Verificar que no se esté intentando cambiar la fecha
        if (date && new Date(date).toISOString().split('T')[0] !== existingKeyframe.date.toISOString().split('T')[0]) {
          return res.status(403).json({ 
            message: 'No se puede modificar la fecha de un keyframe operacional. Solo se puede actualizar el precio.' 
          });
        }
        
        // Solo actualizar el precio
        const keyframe = await prisma.seasonalKeyframe.update({
          where: { id },
          data: {
            basePrice: parseFloat(basePrice)
          }
        });

        return res.json(keyframe);
      }

      // Para keyframes normales, validar que la nueva fecha esté dentro de un período de apertura
      const targetDate = new Date(date);
      
      // Buscar períodos operacionales que contengan esta fecha
      const operationalPeriods = await prisma.operationalPeriod.findMany({
        where: {
          hotelId: existingKeyframe.hotelId,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate }
        }
      });

      if (operationalPeriods.length === 0) {
        return res.status(400).json({
          message: 'No se puede mover un keyframe fuera de un período de apertura. La fecha debe estar dentro de un período operacional.'
        });
      }

      const keyframe = await prisma.seasonalKeyframe.update({
        where: { id },
        data: {
          date: new Date(date),
          basePrice: parseFloat(basePrice)
        }
      });

      res.json(keyframe);
    } catch (error) {
      console.error('Error al actualizar keyframe estacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar keyframe estacional
   */
  async deleteSeasonalKeyframe(req, res) {
    try {
      const { id } = req.params;

      // Verificar si el keyframe existe y no es operacional
      const existingKeyframe = await prisma.seasonalKeyframe.findUnique({
        where: { id }
      });

      if (!existingKeyframe) {
        return res.status(404).json({ message: 'Keyframe no encontrado' });
      }

      if (existingKeyframe.isOperational) {
        return res.status(403).json({ 
          message: 'No se puede eliminar un keyframe operacional desde esta interfaz. Use el panel de períodos operacionales.' 
        });
      }

      await prisma.seasonalKeyframe.delete({
        where: { id }
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar keyframe estacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar todos los keyframes de un hotel
   */
  async deleteAllSeasonalKeyframes(req, res) {
    try {
      const { hotelId } = req.params;

      // Solo eliminar keyframes NO operacionales
      await prisma.seasonalKeyframe.deleteMany({
        where: { 
          hotelId,
          isOperational: false // Proteger keyframes operacionales
        }
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar todos los keyframes:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Generar tarifas dinámicas para un rango de fechas
   */
  async generateDynamicRates(req, res) {
    try {
      const { hotelId, roomTypeId } = req.params;
      const { startDate, endDate } = req.body;

      const rates = await dynamicPricingService.generateDynamicRates(
        hotelId,
        parseInt(roomTypeId),
        startDate,
        endDate
      );

      res.json(rates);
    } catch (error) {
      console.error('Error al generar tarifas dinámicas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener tarifas dinámicas para un rango de fechas
   */
  async getDynamicRates(req, res) {
    try {
      const { hotelId, roomTypeId } = req.params;
      const { startDate, endDate } = req.query;

      const rates = await dynamicPricingService.getRatesForDateRange(
        hotelId,
        parseInt(roomTypeId),
        startDate,
        endDate
      );

      res.json(rates);
    } catch (error) {
      console.error('Error al obtener tarifas dinámicas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar tarifa manualmente
   */
  async updateDynamicRate(req, res) {
    try {
      const { hotelId, roomTypeId, date } = req.params;
      const { baseRate, dynamicRate, withBreakfast, withHalfBoard } = req.body;

      const rate = await prisma.dailyRoomRate.upsert({
        where: {
          hotelId_roomTypeId_date: {
            hotelId,
            roomTypeId: parseInt(roomTypeId),
            date: new Date(date)
          }
        },
        update: {
          baseRate: parseFloat(baseRate),
          dynamicRate: parseFloat(dynamicRate),
          withBreakfast: parseFloat(withBreakfast),
          withHalfBoard: parseFloat(withHalfBoard),
          isManualOverride: true
        },
        create: {
          hotelId,
          roomTypeId: parseInt(roomTypeId),
          date: new Date(date),
          baseRate: parseFloat(baseRate),
          dynamicRate: parseFloat(dynamicRate),
          withBreakfast: parseFloat(withBreakfast),
          withHalfBoard: parseFloat(withHalfBoard),
          isManualOverride: true
        }
      });

      res.json(rate);
    } catch (error) {
      console.error('Error al actualizar tarifa dinámica:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener coeficientes de tipos de habitación
   */
  async getRoomTypeCoefficients(req, res) {
    try {
      const { hotelId } = req.params;

      // Obtener todos los tipos de habitación con sus multiplicadores
      const roomTypes = await prisma.roomType.findMany({
        orderBy: { name: 'asc' }
      });

      // Convertir a formato de coeficientes
      const coefficients = {};
      roomTypes.forEach(roomType => {
        coefficients[roomType.name] = roomType.multiplier;
      });

      res.json(coefficients);
    } catch (error) {
      console.error('Error al obtener coeficientes de tipos de habitación:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar coeficientes de tipos de habitación
   */
  async updateRoomTypeCoefficients(req, res) {
    try {
      const { hotelId } = req.params;
      const coefficients = req.body;

      // Actualizar multiplicadores de cada tipo de habitación
      const updatePromises = Object.entries(coefficients).map(([roomTypeName, multiplier]) =>
        prisma.roomType.updateMany({
          where: { name: roomTypeName },
          data: { multiplier: parseFloat(multiplier) }
        })
      );

      await Promise.all(updatePromises);

      res.json({ message: 'Coeficientes actualizados exitosamente' });
    } catch (error) {
      console.error('Error al actualizar coeficientes de tipos de habitación:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener reglas de precios de comidas
   */
  async getMealPricingRules(req, res) {
    try {
      const { hotelId } = req.params;

      const rules = await prisma.mealPricingRule.findUnique({
        where: { hotelId }
      });

      res.json(rules);
    } catch (error) {
      console.error('Error al obtener reglas de comidas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear o actualizar reglas de precios de comidas
   */
  async upsertMealPricingRules(req, res) {
    try {
      const { hotelId } = req.params;
      const rulesData = req.body;

      const rules = await prisma.mealPricingRule.upsert({
        where: { hotelId },
        update: rulesData,
        create: {
          hotelId,
          ...rulesData
        }
      });

      res.json(rules);
    } catch (error) {
      console.error('Error al crear/actualizar reglas de comidas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Aplicar promoción por hueco
   */
  async applyGapPromotion(req, res) {
    try {
      const { roomId, date } = req.params;
      const { discountRate } = req.body;

      const promotion = await dynamicPricingService.applyGapPromotion(
        parseInt(roomId),
        new Date(date),
        discountRate
      );

      res.json(promotion);
    } catch (error) {
      console.error('Error al aplicar promoción por hueco:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener promociones por huecos
   */
  async getGapPromotions(req, res) {
    try {
      const { roomId, date } = req.params;

      const promotions = await dynamicPricingService.getGapPromotions(
        parseInt(roomId),
        new Date(date)
      );

      res.json(promotions);
    } catch (error) {
      console.error('Error al obtener promociones por huecos:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener occupancy score para un día específico
   */
  async getOccupancyScore(req, res) {
    try {
      const { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday } = req.body;

      if (!date || !hotelId) {
        return res.status(400).json({ 
          message: 'Se requieren la fecha y el hotelId' 
        });
      }

      const score = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(date),
        hotelId,
        daysUntilDate: daysUntilDate || 0,
        currentOccupancy: currentOccupancy || 0.5,
        isWeekend: isWeekend || false,
        isHoliday: isHoliday || false
      });

      res.json({ occupancyScore: score });
    } catch (error) {
      console.error('Error al obtener occupancy score:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener información detallada del score de ocupación
   */
  async getDetailedOccupancyScore(req, res) {
    try {
      const { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday } = req.body;

      if (!date || !hotelId) {
        return res.status(400).json({ 
          message: 'Se requieren la fecha y el hotelId' 
        });
      }

      // Obtener configuración de precios dinámicos
      const config = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      if (!config) {
        return res.status(404).json({ 
          message: 'No se encontró configuración de precios dinámicos para este hotel' 
        });
      }

      // Calcular el score
      const occupancyScore = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(date),
        hotelId,
        daysUntilDate: daysUntilDate || 0,
        currentOccupancy: currentOccupancy || 0.5,
        isWeekend: isWeekend || false,
        isHoliday: isHoliday || false
      });

      // Calcular ocupación real
      const realOccupancy = await dynamicPricingService.calculateRealOccupancy(hotelId, new Date(date));
      
      // Calcular factor de anticipación
      const anticipationFactor = dynamicPricingService.calculateAnticipationFactor(
        daysUntilDate || 0, 
        config
      );
      
      // Preparar respuesta detallada
      const detailedScore = {
        occupancyScore,
        date: new Date(date),
        hotelId,
        daysUntilDate: daysUntilDate || 0,
        currentOccupancy: realOccupancy, // Usar ocupación real en lugar del valor hardcodeado
        isWeekend: isWeekend || false,
        isHoliday: isHoliday || false,
        // Factores calculados
        anticipationFactor,
        // Pesos de configuración
        globalOccupancyWeight: config.globalOccupancyWeight,
        anticipationWeight: config.anticipationWeight,
        isWeekendWeight: config.isWeekendWeight,
        isHolidayWeight: config.isHolidayWeight,
        weatherScoreWeight: config.weatherScoreWeight,
        eventImpactWeight: config.eventImpactWeight,
        // Valores por defecto para factores no proporcionados
        weatherScore: 0.5,
        eventImpact: 0.5
      };

      res.json(detailedScore);
    } catch (error) {
      console.error('Error al obtener score detallado de ocupación:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Calcular score de ocupación (método existente)
   */
  async calculateOccupancyScore(req, res) {
    try {
      const { date, hotelId } = req.params;
      const params = req.body;

      const score = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(date),
        hotelId,
        ...params
      });

      res.json({ score });
    } catch (error) {
      console.error('Error al calcular score de ocupación:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener tarifas calculadas para un rango de fechas y tipo de habitación
   */
  async getCalculatedRates(req, res) {
    try {
      const { hotelId, roomTypeId } = req.params;
      const { startDate, endDate, serviceType = 'base' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Se requieren las fechas de inicio y fin' 
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        return res.status(400).json({ 
          message: 'La fecha de inicio debe ser anterior a la fecha de fin' 
        });
      }

      // Obtener las tarifas para el rango de fechas
      const rates = await dynamicPricingService.getRatesForDateRange(
        hotelId, 
        parseInt(roomTypeId), 
        start, 
        end
      );

      // Si no hay tarifas calculadas, generarlas
      if (rates.length === 0) {
        await dynamicPricingService.generateDynamicRates(
          hotelId, 
          parseInt(roomTypeId), 
          start, 
          end
        );
        
        // Obtener las tarifas generadas
        const generatedRates = await dynamicPricingService.getRatesForDateRange(
          hotelId, 
          parseInt(roomTypeId), 
          start, 
          end
        );
        
        rates.push(...generatedRates);
      }

      // Calcular el total según el tipo de servicio (excluyendo el día de salida)
      let totalAmount = 0;
      const ratesWithService = rates.map((rate, index) => {
        let serviceRate = rate.baseRate;
        
        switch (serviceType) {
          case 'breakfast':
            serviceRate = rate.withBreakfast;
            break;
          case 'halfBoard':
            serviceRate = rate.withHalfBoard;
            break;
          default:
            serviceRate = rate.baseRate;
        }
        
        // Solo sumar al total si no es el último día (día de salida)
        if (index < rates.length - 1) {
          totalAmount += serviceRate;
        }
        
        return {
          ...rate,
          serviceRate,
          serviceType
        };
      });

      // Calcular el número correcto de noches (excluyendo el día de salida)
      const numberOfNights = rates.length - 1;
      
      res.json({
        rates: ratesWithService,
        totalAmount,
        serviceType,
        numberOfNights: numberOfNights,
        averageRatePerNight: numberOfNights > 0 ? totalAmount / numberOfNights : 0
      });
    } catch (error) {
      console.error('Error al obtener tarifas calculadas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Verificar si una fecha es parte de un feriado/fin de semana largo
   */
  async checkLongWeekendOrHoliday(req, res) {
    try {
      const { date, hotelId } = req.body;

      if (!date || !hotelId) {
        return res.status(400).json({ 
          message: 'Se requieren la fecha y el hotelId' 
        });
      }

      const targetDate = new Date(date);
      
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ message: 'Fecha inválida' });
      }

      const isLongWeekendOrHoliday = await dynamicPricingService.isLongWeekendOrHoliday(targetDate, hotelId);

      res.json({
        date: targetDate.toISOString(),
        hotelId,
        isLongWeekendOrHoliday
      });
    } catch (error) {
      console.error('Error al verificar feriado/fin de semana largo:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener los porcentajes máximos de descuento y recargo posibles según la configuración actual
   */
  async getMaxAdjustmentPercentages(req, res) {
    try {
      const { hotelId } = req.params;

      const config = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      if (!config) {
        return res.status(404).json({ message: 'Configuración no encontrada' });
      }

      // Calcular el máximo descuento posible sumando todos los factores negativos
      const maxDiscountFactors = [
        config.occupancyAdjustmentPercentage, // Ocupación baja puede generar descuento
        config.anticipationAdjustmentPercentage, // Anticipación baja puede generar descuento
        // Fin de semana y feriados no pueden ser negativos, solo positivos
      ];

      const maxDiscountPercentage = maxDiscountFactors.reduce((sum, factor) => sum + factor, 0);

      // Calcular el máximo recargo posible sumando todos los factores positivos
      const maxIncreaseFactors = [
        config.occupancyAdjustmentPercentage, // Ocupación alta puede generar recargo
        config.weekendAdjustmentPercentage, // Fin de semana siempre es positivo
        config.holidayAdjustmentPercentage, // Feriados siempre son positivos
      ];

      const maxIncreasePercentage = maxIncreaseFactors.reduce((sum, factor) => sum + factor, 0);

      const result = {
        maxDiscountPercentage: maxDiscountPercentage,
        maxIncreasePercentage: maxIncreasePercentage,
        breakdown: {
          occupancyAdjustment: config.occupancyAdjustmentPercentage,
          anticipationAdjustment: config.anticipationAdjustmentPercentage,
          weekendAdjustment: config.weekendAdjustmentPercentage,
          holidayAdjustment: config.holidayAdjustmentPercentage
        },
        explanation: {
          maxDiscount: `Máximo descuento posible: ${maxDiscountPercentage.toFixed(1)}% (suma de ocupación y anticipación)`,
          maxIncrease: `Máximo recargo posible: ${maxIncreasePercentage.toFixed(1)}% (suma de todos los factores)`
        }
      };

      res.json(result);
    } catch (error) {
      console.error('Error al calcular porcentajes máximos:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = new DynamicPricingController(); 