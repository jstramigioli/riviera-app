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

        // Obtener configuración de días de fin de semana
        const weekendConfig = await this.prisma.dynamicPricingConfig.findUnique({
          where: { hotelId: 'default-hotel' }
        });
        
        // Determinar si es fin de semana según la configuración
        const weekendDays = weekendConfig?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
        const isWeekend = weekendDays.includes(date.getDay());
        const isHoliday = openDay?.isHoliday || false;

        // Calcular tarifa base desde curva estacional
        const baseRate = await this.dynamicPricingService.interpolateBasePrice(date, 'default-hotel');
        
        // Usar la tarifa base directamente (sin multiplicador)
        const adjustedBaseRate = baseRate;

        // Calcular ocupación real
        const realOccupancy = await this.dynamicPricingService.calculateRealOccupancy('default-hotel', date);

        // Calcular porcentajes de ajuste individuales
        const adjustmentPercentages = await this.dynamicPricingService.calculateIndividualAdjustmentPercentages({
          date,
          hotelId: 'default-hotel',
          daysUntilDate,
          currentOccupancy: realOccupancy * 100, // Convertir a porcentaje
          isWeekend,
          isHoliday
        });

        // Obtener configuración de precios dinámicos
        const config = await this.prisma.dynamicPricingConfig.findUnique({
          where: { hotelId: 'default-hotel' }
        });

        // Calcular tarifa dinámica usando el nuevo sistema
        const dynamicRate = config && config.enabled
          ? this.dynamicPricingService.applyDynamicAdjustment(adjustedBaseRate, adjustmentPercentages, config)
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

        // Calcular ajustes usando los porcentajes individuales
        const occupancyAdjustment = config && config.enabled 
          ? adjustedBaseRate * adjustmentPercentages.occupancyAdjustment
          : 0;

        const weekendAdjustment = config && config.enabled
          ? adjustedBaseRate * adjustmentPercentages.weekendAdjustment
          : (isWeekend ? adjustedBaseRate * 0.1 : 0); // Fallback al 10% si no está habilitado

        const holidayAdjustment = config && config.enabled
          ? adjustedBaseRate * adjustmentPercentages.holidayAdjustment
          : (isHoliday ? adjustedBaseRate * 0.3 : 0); // Fallback al 30% si no está habilitado

        const anticipationAdjustment = config && config.enabled
          ? adjustedBaseRate * adjustmentPercentages.anticipationAdjustment
          : 0;

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
            occupancyScore: realOccupancy * 100, // Usar la ocupación real como score
            isWeekend,
            isHoliday,
            gapPromotionApplied: !!gapPromotion,
            gapPromotionRate,
            basePrice: adjustedBaseRate,
            occupancyAdjustment,
            weekendAdjustment,
            holidayAdjustment,
            anticipationAdjustment,
            gapPromotionAmount,
            serviceAdjustment
          }
        });

        nightRates.push(nightRate);
      }

      // Actualizar el total de la reserva
      const totalAmount = nightRates.reduce((sum, rate) => sum + rate.finalRate, 0);
      // TODO: El modelo Reservation no tiene campo totalAmount, necesitamos agregarlo al esquema
      // await this.prisma.reservation.update({
      //   where: { id: reservationId },
      //   data: { totalAmount }
      // });

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
        anticipationAdjustments: nightRates.reduce((sum, rate) => sum + (rate.anticipationAdjustment || 0), 0),
        gapPromotions: nightRates.reduce((sum, rate) => sum + (rate.gapPromotionAmount || 0), 0),
        serviceAdjustments: nightRates.reduce((sum, rate) => sum + (rate.serviceAdjustment || 0), 0)
      },
      nightRates
    };

    return summary;
  }
}

module.exports = ReservationPricingService; 