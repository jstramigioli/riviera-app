const { PrismaClient } = require('@prisma/client');
const dynamicPricingService = require('./dynamicPricingService');

class ReservationPricingService {
  constructor(prisma) {
    this.prisma = prisma;
    this.dynamicPricingService = dynamicPricingService;
  }

  /**
   * Calcula y almacena las tarifas detalladas por noche para una reserva
   */
  async calculateAndStoreNightRates(reservationId, roomId, checkIn, checkOut, serviceType = 'breakfast') {
    try {
      // Obtener información de la habitación y tipo
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true }
      });

      if (!room) {
        throw new Error('Habitación no encontrada');
      }

      const nightRates = [];
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Calcular tarifas para cada noche (excluyendo el día de salida)
      for (let date = new Date(checkInDate); date < checkOutDate; date.setDate(date.getDate() + 1)) {
        const currentDate = new Date();
        const daysUntilDate = Math.ceil((date - currentDate) / (1000 * 60 * 60 * 24));
        
        // Obtener información del día
        const openDay = await this.prisma.openDay.findUnique({
          where: { 
            hotelId_date: {
              hotelId: 'default-hotel',
              date: date
            }
          }
        });

        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isHoliday = openDay?.isHoliday || false;

        // Calcular tarifa base desde curva estacional
        const baseRate = await this.dynamicPricingService.interpolateBasePrice(date, 'default-hotel');
        
        // Aplicar multiplicador del tipo de habitación
        const adjustedBaseRate = baseRate * room.roomType.multiplier;

        // Calcular occupancy score
        const occupancyScore = await this.dynamicPricingService.calculateExpectedOccupancyScore({
          date,
          hotelId: 'default-hotel',
          daysUntilDate,
          currentOccupancy: 50,
          isWeekend,
          isHoliday
        });

        // Obtener configuración de precios dinámicos
        const config = await this.prisma.dynamicPricingConfig.findUnique({
          where: { hotelId: 'default-hotel' }
        });

        // Calcular tarifa dinámica
        const dynamicRate = config && config.enabled
          ? this.dynamicPricingService.applyDynamicAdjustment(adjustedBaseRate, occupancyScore, config)
          : adjustedBaseRate;

        // Calcular precios con comidas
        const mealPrices = await this.dynamicPricingService.calculateMealPrices(dynamicRate, 'default-hotel');

        // Determinar tarifa del servicio
        let serviceRate;
        switch (serviceType) {
          case 'breakfast':
            serviceRate = mealPrices.withBreakfast;
            break;
          case 'halfBoard':
            serviceRate = mealPrices.withHalfBoard;
            break;
          default:
            serviceRate = dynamicRate;
        }

        // Verificar si hay promociones por huecos
        const gapPromotion = await this.prisma.roomGapPromotion.findFirst({
          where: {
            roomId: roomId,
            date: date
          }
        });

        let finalRate = serviceRate;
        let gapPromotionAmount = 0;
        let gapPromotionRate = null;

        if (gapPromotion) {
          gapPromotionAmount = serviceRate * gapPromotion.discountRate;
          finalRate = serviceRate - gapPromotionAmount;
          gapPromotionRate = gapPromotion.discountRate;
        }

        // Calcular ajustes
        const occupancyAdjustment = config && config.enabled 
          ? this.dynamicPricingService.applyDynamicAdjustment(adjustedBaseRate, occupancyScore, config) - adjustedBaseRate
          : 0;

        const weekendAdjustment = isWeekend ? adjustedBaseRate * 0.1 : 0; // 10% adicional fin de semana
        const holidayAdjustment = isHoliday ? adjustedBaseRate * 0.3 : 0; // 30% adicional feriados
        const serviceAdjustment = serviceRate - dynamicRate;

        // Crear registro de tarifa por noche
        const nightRate = await this.prisma.reservationNightRate.create({
          data: {
            reservationId,
            date,
            baseRate: adjustedBaseRate,
            dynamicRate,
            finalRate,
            serviceType,
            serviceRate,
            occupancyScore,
            isWeekend,
            isHoliday,
            gapPromotionApplied: !!gapPromotion,
            gapPromotionRate,
            basePrice: adjustedBaseRate,
            occupancyAdjustment,
            weekendAdjustment,
            holidayAdjustment,
            gapPromotionAmount,
            serviceAdjustment
          }
        });

        nightRates.push(nightRate);
      }

      // Actualizar el total de la reserva
      const totalAmount = nightRates.reduce((sum, rate) => sum + rate.finalRate, 0);
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: { totalAmount }
      });

      return {
        nightRates,
        totalAmount,
        numberOfNights: nightRates.length
      };

    } catch (error) {
      console.error('Error calculando tarifas por noche:', error);
      throw error;
    }
  }

  /**
   * Obtiene las tarifas detalladas de una reserva
   */
  async getReservationNightRates(reservationId) {
    return await this.prisma.reservationNightRate.findMany({
      where: { reservationId },
      orderBy: { date: 'asc' }
    });
  }

  /**
   * Genera un resumen de tarifas para una reserva
   */
  async getReservationPricingSummary(reservationId) {
    const nightRates = await this.getReservationNightRates(reservationId);
    
    if (nightRates.length === 0) {
      return null;
    }

    const summary = {
      totalAmount: nightRates.reduce((sum, rate) => sum + rate.finalRate, 0),
      numberOfNights: nightRates.length,
      averageRatePerNight: nightRates.reduce((sum, rate) => sum + rate.finalRate, 0) / nightRates.length,
      breakdown: {
        basePrice: nightRates.reduce((sum, rate) => sum + rate.basePrice, 0),
        occupancyAdjustments: nightRates.reduce((sum, rate) => sum + (rate.occupancyAdjustment || 0), 0),
        weekendAdjustments: nightRates.reduce((sum, rate) => sum + (rate.weekendAdjustment || 0), 0),
        holidayAdjustments: nightRates.reduce((sum, rate) => sum + (rate.holidayAdjustment || 0), 0),
        gapPromotions: nightRates.reduce((sum, rate) => sum + (rate.gapPromotionAmount || 0), 0),
        serviceAdjustments: nightRates.reduce((sum, rate) => sum + (rate.serviceAdjustment || 0), 0)
      },
      nightRates
    };

    return summary;
  }
}

module.exports = ReservationPricingService; 