const prisma = require('../utils/prisma');

class OperationalPeriodController {
  /**
   * Obtener todos los períodos operacionales de un hotel
   */
  async getOperationalPeriods(req, res) {
    try {
      const { hotelId } = req.params;
      
      const periods = await prisma.operationalPeriod.findMany({
        where: { hotelId },
        orderBy: { startDate: 'asc' }
      });

      res.json(periods);
    } catch (error) {
      console.error('Error al obtener períodos operacionales:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Crear un nuevo período operacional
   */
  async createOperationalPeriod(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate, label } = req.body;

      // Validar que las fechas sean válidas y establecerlas a mediodía para evitar problemas de zona horaria
      const start = new Date(startDate + 'T12:00:00');
      const end = new Date(endDate + 'T12:00:00');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' });
      }

      // Verificar si hay solapamiento con períodos existentes
      const overlappingPeriod = await prisma.operationalPeriod.findFirst({
        where: {
          hotelId,
          OR: [
            {
              AND: [
                { startDate: { lte: start } },
                { endDate: { gt: start } }
              ]
            },
            {
              AND: [
                { startDate: { lt: end } },
                { endDate: { gte: end } }
              ]
            },
            {
              AND: [
                { startDate: { gte: start } },
                { endDate: { lte: end } }
              ]
            }
          ]
        }
      });

      if (overlappingPeriod) {
        return res.status(409).json({ 
          message: 'Existe un período que se solapa con las fechas especificadas',
          overlappingPeriod 
        });
      }

      const period = await prisma.operationalPeriod.create({
        data: {
          hotelId,
          startDate: start,
          endDate: end,
          label
        }
      });

      // Crear keyframes operacionales automáticamente
      try {
        console.log('🔧 Creando keyframes operacionales para período:', period.id);
        
        // Obtener el precio base promedio de keyframes existentes para usar como referencia
        const existingKeyframes = await prisma.seasonalKeyframe.findMany({
          where: {
            hotelId,
            isOperational: false
          },
          orderBy: { date: 'desc' },
          take: 5
        });

        console.log(`📊 Keyframes existentes encontrados: ${existingKeyframes.length}`);

        let basePrice = 8000; // Precio por defecto
        if (existingKeyframes.length > 0) {
          const totalPrice = existingKeyframes.reduce((sum, k) => sum + k.basePrice, 0);
          basePrice = Math.round(totalPrice / existingKeyframes.length);
          console.log(`💰 Precio base calculado: $${basePrice.toLocaleString()}`);
        } else {
          console.log(`💰 Usando precio base por defecto: $${basePrice.toLocaleString()}`);
        }

        console.log(`📅 Creando keyframe de apertura para: ${start.toISOString()}`);
        // Keyframe de apertura
        const openingKeyframe = await prisma.seasonalKeyframe.create({
          data: {
            hotelId,
            date: start,
            basePrice: basePrice,
            isOperational: true,
            operationalType: 'opening',
            periodId: period.id
          }
        });
        console.log(`✅ Keyframe de apertura creado: ${openingKeyframe.id}`);

        console.log(`📅 Creando keyframe de cierre para: ${end.toISOString()}`);
        // Keyframe de cierre
        const closingKeyframe = await prisma.seasonalKeyframe.create({
          data: {
            hotelId,
            date: end,
            basePrice: basePrice,
            isOperational: true,
            operationalType: 'closing',
            periodId: period.id
          }
        });
        console.log(`✅ Keyframe de cierre creado: ${closingKeyframe.id}`);
        
        console.log('🎉 Keyframes operacionales creados exitosamente');
      } catch (keyframeError) {
        console.error('❌ Error al crear keyframes operacionales:', keyframeError);
        // No fallar la creación del período si fallan los keyframes
      }

      res.status(201).json(period);
    } catch (error) {
      console.error('Error al crear período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar un período operacional
   */
  async updateOperationalPeriod(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate, label } = req.body;

      // Validar que las fechas sean válidas y establecerlas a mediodía para evitar problemas de zona horaria
      const start = new Date(startDate + 'T12:00:00');
      const end = new Date(endDate + 'T12:00:00');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' });
      }

      // Verificar si hay solapamiento con otros períodos (excluyendo el actual)
      const overlappingPeriod = await prisma.operationalPeriod.findFirst({
        where: {
          hotelId: (await prisma.operationalPeriod.findUnique({ where: { id } })).hotelId,
          id: { not: id },
          OR: [
            {
              AND: [
                { startDate: { lte: start } },
                { endDate: { gt: start } }
              ]
            },
            {
              AND: [
                { startDate: { lt: end } },
                { endDate: { gte: end } }
              ]
            },
            {
              AND: [
                { startDate: { gte: start } },
                { endDate: { lte: end } }
              ]
            }
          ]
        }
      });

      if (overlappingPeriod) {
        return res.status(409).json({ 
          message: 'Existe otro período que se solapa con las fechas especificadas',
          overlappingPeriod 
        });
      }

      const period = await prisma.operationalPeriod.update({
        where: { id },
        data: {
          startDate: start,
          endDate: end,
          label
        }
      });

      // Actualizar keyframes operacionales
      try {
        // Buscar keyframes existentes para este período
        const existingKeyframes = await prisma.seasonalKeyframe.findMany({
          where: {
            periodId: id,
            isOperational: true
          }
        });

        // Actualizar keyframe de apertura
        const openingKeyframe = existingKeyframes.find(k => k.operationalType === 'opening');
        if (openingKeyframe) {
          await prisma.seasonalKeyframe.update({
            where: { id: openingKeyframe.id },
            data: { date: start }
          });
        }

        // Actualizar keyframe de cierre
        const closingKeyframe = existingKeyframes.find(k => k.operationalType === 'closing');
        if (closingKeyframe) {
          await prisma.seasonalKeyframe.update({
            where: { id: closingKeyframe.id },
            data: { date: end }
          });
        }
      } catch (keyframeError) {
        console.error('Error al actualizar keyframes operacionales:', keyframeError);
        // No fallar la actualización del período si fallan los keyframes
      }

      res.json(period);
    } catch (error) {
      console.error('Error al actualizar período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar un período operacional
   */
  async deleteOperationalPeriod(req, res) {
    try {
      const { id } = req.params;

      // Obtener el período antes de eliminarlo para conocer las fechas
      const period = await prisma.operationalPeriod.findUnique({
        where: { id }
      });

      if (!period) {
        return res.status(404).json({ message: 'Período operacional no encontrado' });
      }

      // Verificar si hay reservas en el período antes de eliminar
      const overlappingReservations = await prisma.reservation.findMany({
        where: {
          AND: [
            { checkIn: { lte: period.endDate } },
            { checkOut: { gt: period.startDate } }
          ]
        }
      });

      if (overlappingReservations.length > 0) {
        const reservationCount = overlappingReservations.length;
        return res.status(409).json({ 
          message: `No se puede eliminar el período porque existen ${reservationCount} reserva${reservationCount > 1 ? 's' : ''} en las fechas comprendidas. Por favor, cancela o modifica las reservas antes de eliminar el período.`,
          reservationCount,
          overlappingReservations: overlappingReservations.map(r => ({
            id: r.id,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            status: r.status
          }))
        });
      }

      // Buscar keyframes operacionales asociados
      const operationalKeyframes = await prisma.seasonalKeyframe.findMany({
        where: {
          periodId: id,
          isOperational: true
        }
      });

      // Encontrar las fechas de apertura y cierre
      const openingKeyframe = operationalKeyframes.find(k => k.operationalType === 'opening');
      const closingKeyframe = operationalKeyframes.find(k => k.operationalType === 'closing');

      if (openingKeyframe && closingKeyframe) {
        // Eliminar TODOS los keyframes entre la fecha de apertura y cierre (inclusive)
        await prisma.seasonalKeyframe.deleteMany({
          where: {
            hotelId: period.hotelId,
            date: {
              gte: openingKeyframe.date,
              lte: closingKeyframe.date
            }
          }
        });

        console.log(`🗑️  Eliminados todos los keyframes entre ${openingKeyframe.date.toISOString()} y ${closingKeyframe.date.toISOString()}`);
      } else {
        // Si no se encuentran los keyframes operacionales, eliminar solo los asociados al período
        await prisma.seasonalKeyframe.deleteMany({
          where: {
            periodId: id,
            isOperational: true
          }
        });
      }

      // Eliminar el período
      await prisma.operationalPeriod.delete({
        where: { id }
      });

      res.json({ message: 'Período operacional eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar período operacional:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  /**
   * Verificar si el hotel está abierto en un rango de fechas
   */
  async checkHotelAvailability(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate } = req.query;

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

      // Buscar períodos operacionales que cubran el rango de fechas
      const operationalPeriods = await prisma.operationalPeriod.findMany({
        where: {
          hotelId,
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } }
          ]
        },
        orderBy: { startDate: 'asc' }
      });

      // Verificar si hay cobertura completa del rango
      let isAvailable = false;
      let uncoveredRanges = [];

      if (operationalPeriods.length === 0) {
        // No hay períodos operacionales, el hotel está cerrado
        isAvailable = false;
        uncoveredRanges = [{ start: start, end: end }];
      } else {
        // Verificar cobertura del rango
        let currentDate = new Date(start);
        let coveredRanges = [];

        for (const period of operationalPeriods) {
          const periodStart = new Date(period.startDate);
          const periodEnd = new Date(period.endDate);

          // Si hay un gap antes de este período
          if (currentDate < periodStart) {
            uncoveredRanges.push({
              start: new Date(currentDate),
              end: new Date(periodStart)
            });
          }

          // Actualizar la fecha actual al final del período
          currentDate = new Date(Math.max(currentDate.getTime(), periodEnd.getTime()));
          coveredRanges.push({
            start: new Date(Math.max(start.getTime(), periodStart.getTime())),
            end: new Date(Math.min(end.getTime(), periodEnd.getTime()))
          });
        }

        // Si hay un gap después del último período
        if (currentDate < end) {
          uncoveredRanges.push({
            start: new Date(currentDate),
            end: new Date(end)
          });
        }

        isAvailable = uncoveredRanges.length === 0;
      }

      res.json({
        isAvailable,
        uncoveredRanges,
        operationalPeriods: operationalPeriods.map(p => ({
          id: p.id,
          startDate: p.startDate,
          endDate: p.endDate,
          label: p.label
        }))
      });
    } catch (error) {
      console.error('Error al verificar disponibilidad del hotel:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = new OperationalPeriodController(); 