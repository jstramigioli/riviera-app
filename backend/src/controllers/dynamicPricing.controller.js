const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dynamicPricingService = require('../services/dynamicPricingService');
const { quoteStay } = require('../services/tariffQuoteService');

class DynamicPricingController {

  // Crear keyframes operacionales para un período
  // TODO: Implementar cuando el modelo SeasonalKeyframe esté disponible
  async createOperationalKeyframes(req, res) {
    res.status(501).json({ message: 'Funcionalidad no implementada - modelo SeasonalKeyframe no disponible' });
  }

  // Actualizar keyframes operacionales cuando cambia un período
  // TODO: Implementar cuando el modelo SeasonalKeyframe esté disponible
  async updateOperationalKeyframes(req, res) {
    res.status(501).json({ message: 'Funcionalidad no implementada - modelo SeasonalKeyframe no disponible' });
  }

  // Eliminar keyframes operacionales cuando se elimina un período
  async deleteOperationalKeyframes(req, res) {
    res.status(501).json({
      success: false,
      message: 'Funcionalidad no disponible - modelo SeasonalKeyframe no existe en el esquema actual',
      code: 'SCHEMA_UNAVAILABLE'
    });
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
   * Obtener reglas de precios de comidas
   */
  async getMealPricingRules(req, res) {
    try {
      const { hotelId } = req.params;

      // Por ahora, devolver configuración por defecto ya que la tabla no existe
      const defaultRules = {
        hotelId,
        breakfastMode: "PERCENTAGE",
        breakfastValue: 15,
        dinnerMode: "PERCENTAGE", 
        dinnerValue: 20
      };

      res.json(defaultRules);
    } catch (error) {
      console.error('Error al obtener reglas de comidas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear o actualizar reglas de precios de comidas
   */
  async upsertMealPricingRules(req, res) {
    res.status(501).json({
      success: false,
      message: 'Funcionalidad no disponible - modelo MealPricingRule no existe en el esquema actual',
      code: 'SCHEMA_UNAVAILABLE'
    });
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
      const { date, hotelId, daysUntilDate, currentOccupancy, isWeekend, isHoliday } = req.query;

      if (!date || !hotelId) {
        return res.status(400).json({ 
          message: 'Se requieren la fecha y el hotelId' 
        });
      }

      const score = await dynamicPricingService.calculateExpectedOccupancyScore({
        date: new Date(date),
        hotelId,
        daysUntilDate: parseInt(daysUntilDate) || 0,
        currentOccupancy: parseFloat(currentOccupancy) || 0.5,
        isWeekend: isWeekend === 'true',
        isHoliday: isHoliday === 'true'
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

      const result = await quoteStay({
        prisma,
        hotelId,
        roomTypeId,
        startDate,
        endDate,
        serviceTypeId: serviceType
      });

      if (!result.success && result.error) {
        const status = result.error === 'invalid_dates' || result.error === 'invalid_range' ? 400 : 500;
        return res.status(status).json({ message: result.message });
      }

      // Compatibilidad con frontend: availableServices como nombres o {id,name}
      return res.status(200).json(result);
    } catch (error) {
      console.error('❌ Error al obtener tarifas calculadas:', error);
      res.status(500).json({
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  /**
   * Verificar si una fecha es parte de un feriado/fin de semana largo
   */
  async checkLongWeekendOrHoliday(req, res) {
    try {
      const { date, hotelId } = req.query;

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
   * Obtener configuración de precios dinámicos para un hotel
   */
  async getConfig(req, res) {
    try {
      const { hotelId } = req.params;

      let config = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      if (!config) {
        // Crear configuración por defecto si no existe
        config = await prisma.dynamicPricingConfig.create({
          data: {
            hotelId,
            enabled: false,
            anticipationThresholds: [7, 14, 30],
            anticipationWeight: 0.3,
            globalOccupancyWeight: 0.4,
            isWeekendWeight: 0.2,
            weekendDays: [0, 6], // Domingo y Sábado
            isHolidayWeight: 0.1,
            weatherScoreWeight: 0.0,
            eventImpactWeight: 0.0,
            maxAdjustmentPercentage: 50.0,
            enableGapPromos: true,
            enableWeatherApi: false,
            enableRecentDemand: false,
            anticipationMode: "ESCALONADO",
            anticipationMaxDays: 30,
            standardRate: 50000,
            idealOccupancy: 80.0
          }
        });
      }

      res.json(config);
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear o actualizar configuración de precios dinámicos para un hotel
   */
  async updateConfig(req, res) {
    try {
      const { hotelId } = req.params;
      const configData = req.body;



      // Primero obtener la configuración existente
      const existingConfig = await prisma.dynamicPricingConfig.findUnique({
        where: { hotelId }
      });

      let config;
      if (existingConfig) {
        // Si existe, actualizar solo los campos proporcionados
        config = await prisma.dynamicPricingConfig.update({
          where: { hotelId },
          data: configData
        });
      } else {
        // Si no existe, crear con valores por defecto
        const defaultConfig = {
          hotelId,
          enabled: false,
          anticipationThresholds: [7, 14, 30],
          anticipationWeight: 0.3,
          globalOccupancyWeight: 0.2,
          isWeekendWeight: 0.15,
          weekendDays: [0, 6],
          isHolidayWeight: 0.2,
          weatherScoreWeight: 0.1,
          eventImpactWeight: 0.05,
          maxAdjustmentPercentage: 50,
          enableGapPromos: true,
          enableWeatherApi: false,
          enableRecentDemand: false,
          anticipationMode: 'ESCALONADO',
          anticipationMaxDays: 30,
          anticipationSteps: null,
          standardRate: 100,
          idealOccupancy: 80,
          occupancyAdjustmentPercentage: 20,
          anticipationAdjustmentPercentage: 15,
          weekendAdjustmentPercentage: 10,
          holidayAdjustmentPercentage: 25,
          occupancyEnabled: true,
          anticipationEnabled: true,
          weekendEnabled: true,
          holidayEnabled: true,
          ...configData // Sobrescribir con los datos proporcionados
        };
        
        config = await prisma.dynamicPricingConfig.create({
          data: defaultConfig
        });
      }

      res.json(config);
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
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