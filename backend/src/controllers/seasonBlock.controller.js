const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener el bloque de temporada activo para una fecha específica
exports.getActiveSeasonBlock = async (req, res) => {
  try {
    const { hotelId, date } = req.query;

    if (!hotelId || !date) {
      return res.status(400).json({ 
        message: 'Se requieren hotelId y date' 
      });
    }

    const targetDate = new Date(date);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: 'Fecha inválida' });
    }

    // Buscar bloques que cubran la fecha (tanto borradores como confirmados)
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      },
      orderBy: { isDraft: 'asc' } // Primero los confirmados, luego los borradores
    });

    // Si no hay ningún bloque para esta fecha
    if (seasonBlocks.length === 0) {
      return res.status(404).json({ 
        message: 'No hay tarifas cargadas para la fecha especificada',
        hasActiveBlock: false,
        hasDraftBlock: false,
        reason: 'no_blocks_for_date'
      });
    }

    // Buscar el primer bloque confirmado (no borrador)
    const activeBlock = seasonBlocks.find(block => !block.isDraft);
    
    if (!activeBlock) {
      // Solo hay borradores, no hay bloque confirmado
      const draftBlocks = seasonBlocks.filter(block => block.isDraft);
      return res.status(404).json({ 
        message: 'No hay tarifas confirmadas para la fecha especificada. Existen bloques en borrador.',
        hasActiveBlock: false,
        hasDraftBlock: true,
        draftBlocks: draftBlocks.map(block => ({
          id: block.id,
          name: block.name,
          startDate: block.startDate,
          endDate: block.endDate
        })),
        reason: 'only_draft_blocks'
      });
    }

    // Hay un bloque confirmado activo
    res.json({
      seasonBlock: activeBlock,
      hasActiveBlock: true,
      hasDraftBlock: seasonBlocks.some(block => block.isDraft),
      message: 'Bloque de temporada activo encontrado'
    });
  } catch (error) {
    console.error('Error al obtener bloque de temporada activo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función auxiliar para validar fechas
const validateDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Las fechas proporcionadas no son válidas';
  }
  
  if (start >= end) {
    return 'La fecha de inicio debe ser anterior a la fecha de fin';
  }
  
  return null;
};

// Función auxiliar para aplicar redondeo
const applyRounding = (price, roundingConfig) => {
  if (!roundingConfig || !price) return price;
  
  const { multiple, mode } = roundingConfig;
  
  switch (mode) {
    case 'ceil':
      return Math.ceil(price / multiple) * multiple;
    case 'floor':
      return Math.floor(price / multiple) * multiple;
    case 'nearest':
    default:
      return Math.round(price / multiple) * multiple;
  }
};

// Obtener todos los bloques de temporada
exports.getAllSeasonBlocks = async (req, res) => {
  try {
    const { hotelId = 'default-hotel' } = req.query;
    
    const blocks = await prisma.seasonBlock.findMany({
      where: { hotelId },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        },
        proportionCoefficients: {
          include: {
            roomType: true
          }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: blocks, errors: null });
  } catch (error) {
    console.error('Error fetching season blocks:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener los bloques de temporada'] 
    });
  }
};

// Obtener un bloque específico
exports.getSeasonBlockById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== GET SEASON BLOCK ===');
    console.log('Requested block ID:', id);
    
    const block = await prisma.seasonBlock.findUnique({
      where: { id },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        },
        proportionCoefficients: {
          include: {
            roomType: true
          }
        }
      }
    });
    
    if (!block) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    console.log('Block loaded from database:', {
      id: block.id,
      name: block.name,
      serviceAdjustmentMode: block.serviceAdjustmentMode
    });
    
    res.json({ data: block, errors: null });
  } catch (error) {
    console.error('Error fetching season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener el bloque de temporada'] 
    });
  }
};

// Crear nuevo bloque de temporada
exports.createSeasonBlock = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      startDate, 
      endDate, 
      hotelId,
      useProportions = false,
      serviceAdjustmentMode = 'PERCENTAGE',
      useBlockServices = false,
      prices = [],
      blockServiceSelections = []
    } = req.body;
    
    // Obtener el hotel por defecto si no se especifica
    let finalHotelId = hotelId;
    if (!finalHotelId) {
      const defaultHotel = await prisma.hotel.findFirst();
      if (!defaultHotel) {
        return res.status(400).json({ 
          data: null, 
          errors: ['No se encontró ningún hotel en el sistema'] 
        });
      }
      finalHotelId = defaultHotel.id;
    }
    
    // Validaciones básicas
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre del bloque es requerido'] 
      });
    }
    
    // Verificar que no haya otro bloque con el mismo nombre (tanto borradores como confirmados)
    const existingBlock = await prisma.seasonBlock.findFirst({
      where: { 
        hotelId: finalHotelId,
        name: name.trim()
      }
    });
    
    if (existingBlock) {
      const blockType = existingBlock.isDraft ? 'borrador' : 'confirmado';
      return res.status(400).json({ 
        data: null, 
        errors: [`Ya existe un bloque ${blockType} con ese nombre`] 
      });
    }
    
    // Validar superposición de fechas solo con bloques activos
    if (startDate && endDate) {
      const overlappingBlocks = await prisma.seasonBlock.findMany({
        where: {
          hotelId: finalHotelId,
          isDraft: false, // Solo verificar bloques activos
          OR: [
            // Bloque nuevo empieza dentro de un bloque existente
            {
              startDate: { lte: new Date(startDate) },
              endDate: { gte: new Date(startDate) }
            },
            // Bloque nuevo termina dentro de un bloque existente
            {
              startDate: { lte: new Date(endDate) },
              endDate: { gte: new Date(endDate) }
            },
            // Bloque nuevo contiene completamente un bloque existente
            {
              startDate: { gte: new Date(startDate) },
              endDate: { lte: new Date(endDate) }
            }
          ]
        }
      });
      
      if (overlappingBlocks.length > 0) {
        return res.status(400).json({ 
          data: null, 
          errors: ['Las fechas se superponen con otro bloque existente'] 
        });
      }
    }

    // Obtener el campo isDraft del body
    const isDraft = req.body.isDraft || false;

    // Solo validar fechas si se proporcionan fechas completas
    if (startDate && endDate) {
      const dateValidation = validateDates(startDate, endDate);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }

      // Solo verificar superposición de fechas si NO es un borrador
      if (!isDraft) {
        const overlappingBlock = await prisma.seasonBlock.findFirst({
          where: {
            hotelId: finalHotelId,
            isDraft: false, // Solo verificar superposición con bloques confirmados
            OR: [
              // Caso 1: El nuevo bloque empieza durante un bloque existente
              {
                startDate: { lte: new Date(startDate) },
                endDate: { gte: new Date(startDate) }
              },
              // Caso 2: El nuevo bloque termina durante un bloque existente
              {
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(endDate) }
              },
              // Caso 3: El nuevo bloque contiene completamente un bloque existente
              {
                startDate: { gte: new Date(startDate) },
                endDate: { lte: new Date(endDate) }
              }
            ]
          }
        });

        if (overlappingBlock) {
          return res.status(409).json({
            data: null,
            errors: [`Existe superposición con el bloque ${overlappingBlock.isDraft ? 'borrador' : 'confirmado'} "${overlappingBlock.name}" (${new Date(overlappingBlock.startDate).toLocaleDateString('es-AR')} - ${new Date(overlappingBlock.endDate).toLocaleDateString('es-AR')})`],
            conflictData: {
              overlappingBlock: {
                id: overlappingBlock.id,
                name: overlappingBlock.name,
                startDate: overlappingBlock.startDate,
                endDate: overlappingBlock.endDate
              }
            }
          });
        }
      }
    }
    
    // Obtener el siguiente orderIndex
    const lastBlock = await prisma.seasonBlock.findFirst({
      where: { hotelId: finalHotelId },
      orderBy: { orderIndex: 'desc' }
    });
    const orderIndex = (lastBlock?.orderIndex || 0) + 1;
    
    // Crear el bloque y inicializar datos por defecto en una transacción
    const completeBlock = await prisma.$transaction(async (tx) => {
      // Crear el bloque
      const block = await tx.seasonBlock.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          hotelId: finalHotelId,
          useProportions: useProportions ?? true, // Activar proporciones por defecto
          serviceAdjustmentMode,
          useBlockServices,
          isDraft: isDraft, // Agregar el campo isDraft
          orderIndex
        }
      });

      // Obtener tipos de habitación y servicios
      const roomTypes = await tx.roomType.findMany();
      const serviceTypes = await tx.serviceType.findMany({
        where: { hotelId: finalHotelId }
      });

      // Crear precios base por defecto
      const basePrice = 50000; // $500 por defecto
      const seasonPrices = [];
      for (const roomType of roomTypes) {
        for (const serviceType of serviceTypes) {
          seasonPrices.push({
            seasonBlockId: block.id,
            roomTypeId: roomType.id,
            serviceTypeId: serviceType.id,
            basePrice: basePrice
          });
        }
      }
      
      if (seasonPrices.length > 0) {
        await tx.seasonPrice.createMany({
          data: seasonPrices
        });
      }

      // Crear selecciones de servicios por defecto
      const blockServiceSelections = serviceTypes.map(serviceType => ({
        seasonBlockId: block.id,
        serviceTypeId: serviceType.id,
        isEnabled: true,
        orderIndex: serviceType.orderIndex
      }));

      if (blockServiceSelections.length > 0) {
        await tx.blockServiceSelection.createMany({
          data: blockServiceSelections
        });
      }

      // Obtener el bloque completo con relaciones
      return await tx.seasonBlock.findUnique({
        where: { id: block.id },
        include: {
          seasonPrices: {
            include: {
              roomType: true,
              serviceType: true
            }
          },
          blockServiceSelections: {
            include: {
              serviceType: true
            }
          }
        }
      });
    });
    
    res.status(201).json({ data: completeBlock, errors: null });
  } catch (error) {
    console.error('Error creating season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al crear el bloque de temporada'] 
    });
  }
};

// Actualizar bloque de temporada (guardar cambios reales pero marcados como borrador)
exports.updateSeasonBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name,
      description,
      startDate,
      endDate,
      useProportions,
      serviceAdjustmentMode,
      useBlockServices,
      isDraft,
      prices = [],
      blockServiceSelections = []
    } = req.body;
    
    console.log('=== UPDATE SEASON BLOCK (SAVE CHANGES) ===');
    console.log('Block ID:', id);
    console.log('Received serviceAdjustmentMode:', serviceAdjustmentMode);
    console.log('Full request body:', req.body);
    
    // Verificar que el bloque existe
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // 🚨 VALIDACIÓN CRÍTICA: Si se está intentando activar un bloque (isDraft: false), verificar superposición
    if (isDraft === false) {
      console.log('🔍 Validando superposición al activar bloque...');
      console.log('📅 Fechas del bloque a activar:', { startDate: existingBlock.startDate, endDate: existingBlock.endDate });
      
      const overlappingBlock = await prisma.seasonBlock.findFirst({
        where: {
          hotelId: existingBlock.hotelId,
          id: { not: id }, // Excluir el bloque actual
          isDraft: false, // Solo verificar contra bloques activos
          OR: [
            // Caso 1: El bloque a activar empieza durante un bloque activo
            {
              startDate: { lte: new Date(existingBlock.startDate) },
              endDate: { gte: new Date(existingBlock.startDate) }
            },
            // Caso 2: El bloque a activar termina durante un bloque activo
            {
              startDate: { lte: new Date(existingBlock.endDate) },
              endDate: { gte: new Date(existingBlock.endDate) }
            },
            // Caso 3: El bloque a activar contiene completamente un bloque activo
            {
              startDate: { gte: new Date(existingBlock.startDate) },
              endDate: { lte: new Date(existingBlock.endDate) }
            }
          ]
        }
      });

      if (overlappingBlock) {
        console.log('🚨 Superposición detectada al activar:', overlappingBlock.name);
        return res.status(409).json({
          data: null,
          errors: [`No se puede activar: las fechas se superponen con el bloque activo "${overlappingBlock.name}" (${new Date(overlappingBlock.startDate).toLocaleDateString('es-AR')} - ${new Date(overlappingBlock.endDate).toLocaleDateString('es-AR')})`],
          conflictData: {
            overlappingBlock: {
              id: overlappingBlock.id,
              name: overlappingBlock.name,
              startDate: overlappingBlock.startDate,
              endDate: overlappingBlock.endDate
            }
          }
        });
      }
    }
    
    // Solo validar fechas si se proporcionan fechas completas
    if (startDate && endDate) {
      const dateValidation = validateDates(startDate, endDate);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }

      // Verificar superposición de fechas solo con bloques activos (no borradores)
      const overlappingBlock = await prisma.seasonBlock.findFirst({
        where: {
          hotelId: existingBlock.hotelId,
          id: { not: id }, // Excluir el bloque actual
          isDraft: false, // Solo verificar bloques activos
          OR: [
            // Caso 1: El bloque actualizado empieza durante un bloque existente
            {
              startDate: { lte: new Date(startDate) },
              endDate: { gte: new Date(startDate) }
            },
            // Caso 2: El bloque actualizado termina durante un bloque existente
            {
              startDate: { lte: new Date(endDate) },
              endDate: { gte: new Date(endDate) }
            },
            // Caso 3: El bloque actualizado contiene completamente un bloque existente
            {
              startDate: { gte: new Date(startDate) },
              endDate: { lte: new Date(endDate) }
            }
          ]
        }
      });

      if (overlappingBlock) {
        return res.status(409).json({
          data: null,
          errors: [`Existe superposición con el bloque ${overlappingBlock.isDraft ? 'borrador' : 'confirmado'} "${overlappingBlock.name}" (${new Date(overlappingBlock.startDate).toLocaleDateString('es-AR')} - ${new Date(overlappingBlock.endDate).toLocaleDateString('es-AR')})`],
          conflictData: {
            overlappingBlock: {
              id: overlappingBlock.id,
              name: overlappingBlock.name,
              startDate: overlappingBlock.startDate,
              endDate: overlappingBlock.endDate
            }
          }
        });
      }
    }
    
    // Actualizar en transacción (guardar cambios reales pero marcados como borrador)
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar el bloque
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (useProportions !== undefined) updateData.useProportions = useProportions;
      if (serviceAdjustmentMode !== undefined) updateData.serviceAdjustmentMode = serviceAdjustmentMode;
      if (useBlockServices !== undefined) updateData.useBlockServices = useBlockServices;
      if (isDraft !== undefined) updateData.isDraft = isDraft;
      
      // Solo marcar como borrador si no se especifica explícitamente el estado
      if (isDraft === undefined) {
        updateData.isDraft = true;
      }
      
      console.log('Update data to be applied:', updateData);
      
      const block = await tx.seasonBlock.update({
        where: { id },
        data: updateData
      });
      
      console.log('Block updated successfully:', {
        id: block.id,
        serviceAdjustmentMode: block.serviceAdjustmentMode,
        isDraft: block.isDraft
      });
      
      // Actualizar precios (guardar cambios reales pero marcados como borrador)
      if (prices.length > 0) {
        console.log('=== BACKEND: UPDATING PRICES ===');
        console.log('Received prices:', prices);
        console.log('Prices count:', prices.length);
        
        // Eliminar precios existentes
        await tx.seasonPrice.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevos precios (guardados pero marcados como borrador)
        for (const price of prices) {
          console.log('Creating price:', {
            seasonBlockId: id,
            roomTypeId: price.roomTypeId,
            serviceTypeId: price.serviceTypeId,
            basePrice: parseFloat(price.basePrice) || 0
          });
          
          await tx.seasonPrice.create({
            data: {
              seasonBlockId: id,
              roomTypeId: price.roomTypeId,
              serviceTypeId: price.serviceTypeId,
              basePrice: parseFloat(price.basePrice) || 0,
              isDraft: true
            }
          });
        }
        
        console.log('=== BACKEND: PRICES UPDATED SUCCESSFULLY ===');
      }
      
      // Actualizar selecciones de servicios (guardar cambios reales pero marcados como borrador)
      if (blockServiceSelections && blockServiceSelections.length > 0) {
        console.log('=== BACKEND: UPDATING BLOCK SERVICE SELECTIONS ===');
        console.log('Received blockServiceSelections:', blockServiceSelections);
        console.log('BlockServiceSelections count:', blockServiceSelections.length);
        
        // Log detallado de los porcentajes de ajuste
        blockServiceSelections.forEach((selection, index) => {
          console.log(`Selection ${index + 1}:`, {
            serviceTypeId: selection.serviceTypeId,
            isEnabled: selection.isEnabled,
            percentageAdjustment: selection.percentageAdjustment,
            orderIndex: selection.orderIndex
          });
        });
        
        // Eliminar selecciones existentes
        await tx.blockServiceSelection.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevas selecciones (guardadas pero marcadas como borrador)
        for (const selection of blockServiceSelections) {
          console.log('Creating block service selection:', {
            seasonBlockId: id,
            serviceTypeId: selection.serviceTypeId,
            isEnabled: selection.isEnabled ?? true,
            orderIndex: selection.orderIndex || 0,
            percentageAdjustment: selection.percentageAdjustment ?? 0
          });
          
          await tx.blockServiceSelection.create({
            data: {
              seasonBlockId: id,
              serviceTypeId: selection.serviceTypeId,
              isEnabled: selection.isEnabled ?? true,
              orderIndex: selection.orderIndex || 0,
              percentageAdjustment: selection.percentageAdjustment ?? 0,
              isDraft: true
            }
          });
        }
        
        console.log('=== BACKEND: BLOCK SERVICE SELECTIONS UPDATED SUCCESSFULLY ===');
      }
      
      return block;
    });
    
    // Obtener el bloque completo para la respuesta
    const completeBlock = await prisma.seasonBlock.findUnique({
      where: { id: result.id },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    res.json({ data: completeBlock, errors: null });
  } catch (error) {
    console.error('Error updating season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el bloque de temporada'] 
    });
  }
};

// Confirmar cambios de bloque de temporada (guardar definitivamente)
exports.confirmSeasonBlock = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== CONFIRM SEASON BLOCK ===');
    console.log('Block ID:', id);
    
    // Verificar que el bloque existe
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Confirmar cambios en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Marcar el bloque como guardado
      const block = await tx.seasonBlock.update({
        where: { id },
        data: {
          isDraft: false,
          lastSavedAt: new Date()
        }
      });
      
      // Marcar todos los precios como guardados
      await tx.seasonPrice.updateMany({
        where: { seasonBlockId: id },
        data: { isDraft: false }
      });
      
      // Marcar todas las selecciones de servicios como guardadas
      await tx.blockServiceSelection.updateMany({
        where: { seasonBlockId: id },
        data: { isDraft: false }
      });
      
      console.log('Block confirmed successfully:', {
        id: block.id,
        isDraft: block.isDraft,
        lastSavedAt: block.lastSavedAt
      });
      
      return block;
    });
    
    // Obtener el bloque completo para la respuesta
    const completeBlock = await prisma.seasonBlock.findUnique({
      where: { id: result.id },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    res.json({ 
      data: completeBlock, 
      errors: null,
      message: 'Cambios guardados definitivamente'
    });
  } catch (error) {
    console.error('Error confirming season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al confirmar los cambios del bloque de temporada'] 
    });
  }
};

// Eliminar bloque de temporada
exports.deleteSeasonBlock = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    await prisma.seasonBlock.delete({
      where: { id }
    });
    
    res.json({ 
      data: { message: 'Bloque de temporada eliminado correctamente' }, 
      errors: null 
    });
  } catch (error) {
    console.error('Error deleting season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al eliminar el bloque de temporada'] 
    });
  }
};

// Obtener precios calculados con redondeo
exports.getCalculatedPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const { hotelId = 'default-hotel' } = req.query;
    
    const block = await prisma.seasonBlock.findUnique({
      where: { id },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    if (!block) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Obtener configuración de redondeo
    const roundingConfig = await prisma.roundingConfig.findUnique({
      where: { hotelId }
    });
    
    // Calcular precios con ajustes y redondeo
    const calculatedPrices = block.seasonPrices.map(price => {
      let finalPrice = price.basePrice;
      
      // Aplicar ajuste de servicio si existe
      const serviceSelection = block.blockServiceSelections.find(
        sel => sel.serviceTypeId === price.serviceTypeId && sel.isEnabled
      );
      
      // Aplicar ajuste de porcentaje si existe
      if (serviceSelection && serviceSelection.percentageAdjustment && serviceSelection.percentageAdjustment !== 0) {
        const adjustmentMultiplier = 1 + (serviceSelection.percentageAdjustment / 100);
        finalPrice = Math.round(price.basePrice * adjustmentMultiplier);
        
        console.log('=== BACKEND PRICE CALCULATION DEBUG ===');
        console.log('price.basePrice:', price.basePrice);
        console.log('serviceSelection.percentageAdjustment:', serviceSelection.percentageAdjustment);
        console.log('adjustmentMultiplier:', adjustmentMultiplier);
        console.log('finalPrice:', finalPrice);
      }
      
      // Aplicar redondeo
      const roundedPrice = applyRounding(finalPrice, roundingConfig);
      
      return {
        ...price,
        calculatedPrice: finalPrice,
        roundedPrice: roundedPrice,
        wasRounded: Math.abs(finalPrice - roundedPrice) > 0.01,
        serviceSelection,
        percentageAdjustment: serviceSelection?.percentageAdjustment || 0
      };
    });
    
    res.json({ 
      data: {
        block,
        calculatedPrices,
        roundingConfig
      }, 
      errors: null 
    });
  } catch (error) {
    console.error('Error calculating prices:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al calcular los precios'] 
    });
  }
};

// Clonar bloque de temporada
exports.cloneSeasonBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, newStartDate, newEndDate } = req.body;
    
    console.log('=== CLONE SEASON BLOCK ===');
    console.log('Source block ID:', id);
    console.log('New name:', newName);
    console.log('New start date:', newStartDate);
    console.log('New end date:', newEndDate);
    
    // Obtener el bloque original con todas sus relaciones
    const originalBlock = await prisma.seasonBlock.findUnique({
      where: { id },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    if (!originalBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Validar fechas si se proporcionan
    if (newStartDate && newEndDate) {
      const dateValidation = validateDates(newStartDate, newEndDate);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }
    }
    
    // Obtener el siguiente orderIndex
    const lastBlock = await prisma.seasonBlock.findFirst({
      where: { hotelId: originalBlock.hotelId },
      orderBy: { orderIndex: 'desc' }
    });
    const orderIndex = (lastBlock?.orderIndex || 0) + 1;
    
    // Crear el bloque clonado en una transacción
    const clonedBlock = await prisma.$transaction(async (tx) => {
      // Crear el nuevo bloque
      const newBlock = await tx.seasonBlock.create({
        data: {
          name: newName || `${originalBlock.name} (Copia)`,
          description: originalBlock.description,
          startDate: newStartDate ? new Date(newStartDate) : originalBlock.startDate,
          endDate: newEndDate ? new Date(newEndDate) : originalBlock.endDate,
          hotelId: originalBlock.hotelId,
          useProportions: originalBlock.useProportions,
          serviceAdjustmentMode: originalBlock.serviceAdjustmentMode,
          useBlockServices: originalBlock.useBlockServices,
          isDraft: true, // Siempre crear como borrador
          orderIndex
        }
      });
      
      // Clonar precios
      if (originalBlock.seasonPrices && originalBlock.seasonPrices.length > 0) {
        const clonedPrices = originalBlock.seasonPrices.map(price => ({
          seasonBlockId: newBlock.id,
          roomTypeId: price.roomTypeId,
          serviceTypeId: price.serviceTypeId,
          basePrice: price.basePrice,
          isDraft: true
        }));
        
        await tx.seasonPrice.createMany({
          data: clonedPrices
        });
      }
      
      // Clonar selecciones de servicios
      if (originalBlock.blockServiceSelections && originalBlock.blockServiceSelections.length > 0) {
        const clonedSelections = originalBlock.blockServiceSelections.map(selection => ({
          seasonBlockId: newBlock.id,
          serviceTypeId: selection.serviceTypeId,
          isEnabled: selection.isEnabled,
          orderIndex: selection.orderIndex,
          percentageAdjustment: selection.percentageAdjustment,
          isDraft: true
        }));
        
        await tx.blockServiceSelection.createMany({
          data: clonedSelections
        });
      }
      
      // Obtener el bloque completo con relaciones
      return await tx.seasonBlock.findUnique({
        where: { id: newBlock.id },
        include: {
          seasonPrices: {
            include: {
              roomType: true,
              serviceType: true
            }
          },
          blockServiceSelections: {
            include: {
              serviceType: true
            }
          }
        }
      });
    });
    
    console.log('Block cloned successfully:', {
      originalId: id,
      newId: clonedBlock.id,
      newName: clonedBlock.name
    });
    
    res.status(201).json({ 
      data: clonedBlock, 
      errors: null,
      message: 'Bloque clonado exitosamente'
    });
  } catch (error) {
    console.error('Error cloning season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al clonar el bloque de temporada'] 
    });
  }
};

// Confirmar bloque de temporada (cambiar de borrador a confirmado)
exports.confirmSeasonBlock = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== CONFIRM SEASON BLOCK ===');
    console.log('Block ID:', id);
    
    // Verificar que el bloque existe
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Verificar que el bloque esté en modo borrador
    if (!existingBlock.isDraft) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El bloque ya está confirmado'] 
      });
    }
    
    // Validar que las fechas estén completas
    if (!existingBlock.startDate || !existingBlock.endDate) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El bloque debe tener fechas de inicio y fin completas para ser confirmado'] 
      });
    }
    
    // Validar fechas
    const dateValidation = validateDates(existingBlock.startDate, existingBlock.endDate);
    if (dateValidation) {
      return res.status(400).json({ 
        data: null, 
        errors: [dateValidation] 
      });
    }
    
    // Verificar superposición de fechas con bloques confirmados
    const overlappingBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId: existingBlock.hotelId,
        id: { not: id }, // Excluir el bloque actual
        isDraft: false, // Solo verificar con bloques confirmados
        OR: [
          // Caso 1: El bloque empieza durante un bloque existente
          {
            startDate: { lte: existingBlock.startDate },
            endDate: { gte: existingBlock.startDate }
          },
          // Caso 2: El bloque termina durante un bloque existente
          {
            startDate: { lte: existingBlock.endDate },
            endDate: { gte: existingBlock.endDate }
          },
          // Caso 3: El bloque contiene completamente un bloque existente
          {
            startDate: { gte: existingBlock.startDate },
            endDate: { lte: existingBlock.endDate }
          }
        ]
      }
    });

    if (overlappingBlock) {
      return res.status(409).json({
        data: null,
        errors: [`Existe superposición con el bloque confirmado "${overlappingBlock.name}" (${new Date(overlappingBlock.startDate).toLocaleDateString('es-AR')} - ${new Date(overlappingBlock.endDate).toLocaleDateString('es-AR')})`],
        conflictData: {
          overlappingBlock: {
            id: overlappingBlock.id,
            name: overlappingBlock.name,
            startDate: overlappingBlock.startDate,
            endDate: overlappingBlock.endDate
          }
        }
      });
    }
    
    // Confirmar el bloque (cambiar isDraft a false)
    const confirmedBlock = await prisma.seasonBlock.update({
      where: { id },
      data: {
        isDraft: false,
        lastSavedAt: new Date()
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    console.log('Block confirmed successfully:', {
      id: confirmedBlock.id,
      name: confirmedBlock.name,
      isDraft: confirmedBlock.isDraft
    });
    
    res.json({ 
      data: confirmedBlock, 
      errors: null 
    });
  } catch (error) {
    console.error('Error confirming season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al confirmar el bloque de temporada'] 
    });
  }
}; 

// El archivo ya tiene todas las funciones exportadas correctamente arriba
// No necesitamos la clase duplicada 