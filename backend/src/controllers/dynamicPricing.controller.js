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

      const config = await prisma.dynamicPricingConfig.upsert({
        where: { hotelId },
        update: configData,
        create: {
          hotelId,
          ...configData
        }
      });

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
      const { date, basePrice } = req.body;

      // Verificar si ya existe un keyframe para esta fecha y hotel
      const existingKeyframe = await prisma.seasonalKeyframe.findFirst({
        where: {
          hotelId,
          date: new Date(date)
        }
      });

      if (existingKeyframe) {
        return res.status(409).json({ 
          message: 'Ya existe un precio establecido para esta fecha',
          existingKeyframe 
        });
      }

      const keyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date(date),
          basePrice: parseFloat(basePrice)
        }
      });

      res.status(201).json(keyframe);
    } catch (error) {
      console.error('Error al crear keyframe estacional:', error);
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

      await prisma.seasonalKeyframe.deleteMany({
        where: { hotelId }
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
   * Calcular score de ocupación esperada
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
}

module.exports = new DynamicPricingController(); 