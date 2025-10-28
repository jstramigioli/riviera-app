const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dynamicPricingService = require('../services/dynamicPricingService');

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
      console.log('🔍 getCalculatedRates iniciado con params:', req.params, 'query:', req.query);
      
      const { hotelId, roomTypeId } = req.params;
      const { startDate, endDate, serviceType = 'base' } = req.query;

      if (!startDate || !endDate) {
        console.log('❌ Fechas faltantes');
        return res.status(400).json({ 
          message: 'Se requieren las fechas de inicio y fin' 
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log('❌ Fechas inválidas:', startDate, endDate);
        return res.status(400).json({ message: 'Fechas inválidas' });
      }

      if (start >= end) {
        console.log('❌ Fecha inicio >= fecha fin');
        return res.status(400).json({ 
          message: 'La fecha de inicio debe ser anterior a la fecha de fin' 
        });
      }

      console.log('📅 Buscando tarifas para:', hotelId, roomTypeId, start, end);

      // Obtener bloques de temporada que cubran las fechas solicitadas
      const seasonBlocks = await prisma.seasonBlock.findMany({
        where: { 
          hotelId,
          startDate: { lte: new Date(end) },
          endDate: { gte: new Date(start) }
        },
        include: { 
          seasonPrices: true,
          blockServiceSelections: {
            include: {
              serviceType: true
            }
          }
        }
      });

      console.log('📅 Bloques de temporada disponibles:', seasonBlocks.map(block => ({
        id: block.id,
        name: block.name,
        startDate: block.startDate,
        endDate: block.endDate,
        prices: block.seasonPrices.length,
        enabledServices: block.blockServiceSelections.filter(s => s.isEnabled).map(s => s.serviceType.name)
      })));

      // Calcular servicios habilitados en todos los bloques (intersección)
      let commonServices = [];
      let serviceAvailabilityMessages = [];
      
      // Variables que necesitan estar disponibles en todo el scope
      let requestedServiceName = null;
      let allServices = new Set();
      let allBlocksServices = [];
      
      if (seasonBlocks.length > 0) {
        // Función helper para obtener servicios de un bloque
        const getBlockServices = async (block) => {
          if (block.useBlockServices && block.blockServiceSelections.length > 0) {
            // Usar servicios explícitamente habilitados
            return block.blockServiceSelections
              .filter(selection => selection.isEnabled)
              .map(selection => ({
                id: selection.serviceType.id,
                name: selection.serviceType.name,
                orderIndex: selection.orderIndex
              }));
          } else {
            // Extraer servicios de los precios configurados
            const serviceIds = [...new Set(block.seasonPrices.map(price => price.serviceTypeId))];
            const services = [];
            
            for (const serviceId of serviceIds) {
              try {
                const serviceType = await prisma.serviceType.findUnique({
                  where: { id: serviceId }
                });
                if (serviceType) {
                  services.push({
                    id: serviceType.id,
                    name: serviceType.name,
                    orderIndex: serviceType.orderIndex || 1
                  });
                }
              } catch (error) {
                console.log('Error obteniendo tipo de servicio:', serviceId, error);
              }
            }
            
            return services.sort((a, b) => a.orderIndex - b.orderIndex);
          }
        };

        // Obtener servicios del primer bloque
        const firstBlockServices = await getBlockServices(seasonBlocks[0]);

        // Verificar qué servicios están disponibles en todos los bloques
        allBlocksServices = await Promise.all(
          seasonBlocks.map(block => getBlockServices(block))
        );

        // Encontrar servicios comunes (intersección)
        commonServices = firstBlockServices.filter(service => {
          return allBlocksServices.every(blockServices => 
            blockServices.some(blockService => blockService.id === service.id)
          );
        });

        // Generar mensajes informativos sobre servicios no disponibles
        for (const blockServices of allBlocksServices) {
          blockServices.forEach(service => {
            allServices.add(service.name);
          });
        }
        
        // Detectar si el servicio solicitado está disponible en algunos bloques pero no en todos
        // Buscar el nombre del servicio solicitado en los servicios de los bloques
        for (let i = 0; i < seasonBlocks.length; i++) {
          const blockServices = allBlocksServices[i];
          const serviceInBlock = blockServices.find(service => service.id === serviceType);
          if (serviceInBlock) {
            requestedServiceName = serviceInBlock.name;
            break;
          }
        }
        
        // Si no se encontró el nombre del servicio, intentar obtenerlo de los tipos de servicio
        if (!requestedServiceName) {
          try {
            const serviceTypeRecord = await prisma.serviceType.findUnique({
              where: { id: serviceType }
            });
            if (serviceTypeRecord) {
              requestedServiceName = serviceTypeRecord.name;
            }
          } catch (error) {
            console.log('Error obteniendo nombre del servicio:', error);
          }
        }
        
        console.log('🔍 Debug isPartiallyAvailable:', {
          requestedServiceName,
          allServices: Array.from(allServices),
          commonServices: commonServices.map(s => s.name),
          serviceType,
          seasonBlocksCount: seasonBlocks.length
        });

        const unavailableServices = Array.from(allServices).filter(serviceName => {
          return !commonServices.some(common => common.name === serviceName);
        });

        if (unavailableServices.length > 0) {
          serviceAvailabilityMessages = unavailableServices.map(serviceName => {
            const blocksWithService = seasonBlocks.filter(block => 
              block.blockServiceSelections.some(selection => 
                selection.isEnabled && selection.serviceType.name === serviceName
              )
            );
            
            const startDate = new Date(Math.min(...blocksWithService.map(b => new Date(b.startDate))));
            const endDate = new Date(Math.max(...blocksWithService.map(b => new Date(b.endDate))));
            
            return {
              service: serviceName,
              availableFrom: startDate.toISOString().split('T')[0],
              availableUntil: endDate.toISOString().split('T')[0],
              reason: `Este servicio solo está disponible del ${startDate.toISOString().split('T')[0]} al ${endDate.toISOString().split('T')[0]}`
            };
          });
        }
      }
      
      // Mover isPartiallyAvailable fuera del bloque if para que esté disponible en todo el scope
      // Solo considerar disponibilidad parcial si el servicio existe en algunos bloques pero no en todos
      const isPartiallyAvailable = requestedServiceName && 
        Array.from(allServices).includes(requestedServiceName) && 
        !commonServices.some(service => service.name === requestedServiceName) &&
        (allBlocksServices && allBlocksServices.some(blockServices => 
          blockServices.some(service => service.id === serviceType)
        ));
        
      console.log('🔍 Final isPartiallyAvailable calculation:', {
        requestedServiceName,
        allServicesArray: Array.from(allServices),
        commonServicesNames: commonServices.map(s => s.name),
        isPartiallyAvailable
      });

      console.log('🔍 Servicios comunes entre bloques:', commonServices.map(s => s.name));
      console.log('⚠️ Mensajes de disponibilidad:', serviceAvailabilityMessages);

      // Validar que el servicio solicitado esté disponible
      if (commonServices.length === 0) {
        return res.status(200).json({
          success: true,
          availability: 'no_availability',
          message: 'No hay servicios disponibles para el período solicitado',
          availableBlocks: seasonBlocks.map(block => ({
            name: block.name,
            startDate: block.startDate,
            endDate: block.endDate,
            enabledServices: block.blockServiceSelections.filter(s => s.isEnabled).map(s => s.serviceType.name)
          })),
          serviceAvailabilityMessages
        });
      }

      // Verificar que el servicio solicitado esté en los servicios comunes
      const requestedService = commonServices.find(service => service.id === serviceType);
      
      // Si el servicio no está en los servicios comunes, verificar si está disponible en algún bloque
      const serviceExistsInAnyBlock = allBlocksServices && allBlocksServices.some(blockServices => 
        blockServices.some(service => service.id === serviceType)
      );
      
      console.log('🔍 Debug requestedService:', {
        serviceType,
        requestedService,
        isPartiallyAvailable,
        requestedServiceName,
        serviceExistsInAnyBlock
      });
      
      if (!requestedService && serviceExistsInAnyBlock) {
        // El servicio existe en algún bloque pero no en todos - disponibilidad parcial
        const availablePeriods = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        // Encontrar bloques que tienen el servicio solicitado
        const blocksWithService = [];
        for (let i = 0; i < seasonBlocks.length; i++) {
          const blockServices = allBlocksServices[i];
          if (blockServices.some(service => service.id === serviceType)) {
            blocksWithService.push(seasonBlocks[i]);
          }
        }
        
        // Calcular períodos disponibles
        for (const block of blocksWithService) {
          const blockStart = new Date(block.startDate);
          const blockEnd = new Date(block.endDate);
          
          // Calcular intersección entre el período solicitado y el bloque
          const periodStart = new Date(Math.max(startDate.getTime(), blockStart.getTime()));
          const periodEnd = new Date(Math.min(endDate.getTime(), blockEnd.getTime()));
          
          if (periodStart < periodEnd) {
            availablePeriods.push({
              startDate: periodStart.toISOString().split('T')[0],
              endDate: periodEnd.toISOString().split('T')[0],
              blockName: block.name
            });
          }
        }
        
        return res.status(200).json({
          success: true,
          availability: 'partial_availability',
          message: `Servicio no disponible: El servicio '${requestedServiceName || 'solicitado'}' está disponible parcialmente para el período solicitado. Está disponible en algunos bloques de temporada pero no en todos.`,
          availableServices: commonServices.map(s => ({ id: s.id, name: s.name })),
          serviceAvailabilityMessages,
          isPartiallyAvailable: true,
          availablePeriods,
          suggestedAction: 'Puedes crear segmentos de reserva para los períodos donde el servicio está disponible.',
          serviceName: requestedServiceName || 'Servicio solicitado'
        });
      }
      
      if (!requestedService) {
        let errorMessage = `El servicio '${requestedServiceName || 'solicitado'}' no está disponible para el período solicitado`;
        
        if (isPartiallyAvailable) {
          errorMessage = `Servicio no disponible: El servicio '${requestedServiceName}' está disponible parcialmente para el período solicitado. Está disponible en algunos bloques de temporada pero no en todos.`;
          
          // Calcular períodos disponibles para el servicio solicitado
          const availablePeriods = [];
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Encontrar bloques que tienen el servicio solicitado
          const blocksWithService = [];
          for (let i = 0; i < seasonBlocks.length; i++) {
            const blockServices = allBlocksServices[i];
            if (blockServices.some(service => service.id === serviceType)) {
              blocksWithService.push(seasonBlocks[i]);
            }
          }
          
          // Calcular períodos disponibles
          for (const block of blocksWithService) {
            const blockStart = new Date(block.startDate);
            const blockEnd = new Date(block.endDate);
            
            // Calcular intersección entre el período solicitado y el bloque
            const periodStart = new Date(Math.max(startDate.getTime(), blockStart.getTime()));
            const periodEnd = new Date(Math.min(endDate.getTime(), blockEnd.getTime()));
            
            if (periodStart < periodEnd) {
              availablePeriods.push({
                startDate: periodStart.toISOString().split('T')[0],
                endDate: periodEnd.toISOString().split('T')[0],
                blockName: block.name
              });
            }
          }
          
          return res.status(200).json({
            success: true,
            availability: 'partial_availability',
            message: errorMessage,
            availableServices: commonServices.map(s => ({ id: s.id, name: s.name })),
            serviceAvailabilityMessages,
            isPartiallyAvailable: true,
            availablePeriods,
            suggestedAction: 'Puedes crear segmentos de reserva para los períodos donde el servicio está disponible.',
            serviceName: requestedServiceName || 'Servicio solicitado'
          });
        }
        
        return res.status(200).json({
          success: true,
          availability: 'service_not_available',
          message: `Servicio no disponible: ${errorMessage}`,
          availableServices: commonServices.map(s => ({ id: s.id, name: s.name })),
          serviceAvailabilityMessages,
          isPartiallyAvailable: false,
          suggestedAction: 'Selecciona un servicio diferente que esté disponible para todas las fechas.'
        });
      }

      // Asegurar que el servicio base (primer servicio) esté siempre disponible
      const baseService = commonServices.find(service => service.orderIndex === 1);
      if (!baseService) {
        console.log('⚠️ Servicio base no encontrado, usando el primer servicio disponible');
      }

      // Calcular cuántos días deberían tener tarifas
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      const expectedDays = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
      console.log('📅 Días esperados:', expectedDays);

      // Generar tarifas basadas en los bloques de temporada
      const rates = [];
      const missingDates = [];
      
      for (let date = new Date(startDateObj); date < endDateObj; date.setDate(date.getDate() + 1)) {
        const dateString = date.toISOString().split('T')[0];
        
        // Buscar un bloque de temporada que cubra esta fecha
        const coveringBlock = seasonBlocks.find(block => {
          const blockStart = new Date(block.startDate);
          const blockEnd = new Date(block.endDate);
          return date >= blockStart && date <= blockEnd;
        });
        
        if (coveringBlock) {
          // Buscar el precio para este tipo de habitación y servicio en el bloque
          const roomTypePrice = coveringBlock.seasonPrices.find(price => 
            price.roomTypeId === parseInt(roomTypeId) && 
            price.serviceTypeId === requestedService.id
          );
          
          if (roomTypePrice) {
            rates.push({
              date: new Date(date),
              baseRate: roomTypePrice.basePrice,
              dynamicRate: roomTypePrice.basePrice, // Por ahora usar el mismo precio
              hotelId,
              roomTypeId: parseInt(roomTypeId),
              serviceTypeId: requestedService.id
            });
          } else {
            missingDates.push(new Date(date));
          }
        } else {
          missingDates.push(new Date(date));
        }
      }

      console.log('📊 Tarifas generadas:', rates.length);
      console.log('📊 Fechas de tarifas:', rates.map(r => r.date));

      if (missingDates.length > 0) {
        console.log('⚠️ Fechas sin tarifas disponibles:', missingDates.map(d => d.toISOString().split('T')[0]));
        return res.status(400).json({
          message: 'No hay tarifas disponibles para todas las fechas solicitadas',
          missingDates: missingDates.map(d => d.toISOString().split('T')[0]),
          availableBlocks: seasonBlocks.map(block => ({
            name: block.name,
            startDate: block.startDate,
            endDate: block.endDate
          }))
        });
      }

      // Calcular el total sumando todas las tarifas
      let totalAmount = 0;
      const ratesWithService = rates.map((rate, index) => {
        // Usar solo la tarifa base, sin multiplicadores
        const serviceRate = rate.baseRate;
        
        // Sumar todas las tarifas al total
        totalAmount += serviceRate;
        
        return {
          ...rate,
          serviceRate,
          serviceType
        };
      });

      // El número de noches es igual al número de tarifas
      const numberOfNights = rates.length;
      
      res.status(200).json({
        success: true,
        availability: 'success',
        rates: ratesWithService,
        totalAmount,
        serviceType,
        numberOfNights: numberOfNights,
        averageRatePerNight: numberOfNights > 0 ? totalAmount / numberOfNights : 0,
        availableServices: commonServices.map(s => s.name),
        serviceAvailabilityMessages: serviceAvailabilityMessages.length > 0 ? serviceAvailabilityMessages : undefined
      });
    } catch (error) {
      console.error('❌ Error al obtener tarifas calculadas:', error);
      
      // Si es un error de precios no configurados, devolver 404
      if (error.message.includes('No hay precios configurados')) {
        return res.status(404).json({
          message: 'No se encontraron precios para las fechas solicitadas',
          details: 'No hay bloques de temporada configurados para estas fechas. Por favor, configure precios en el sistema de gestión.',
          error: error.message
        });
      }
      
      // Para otros errores, devolver 500
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