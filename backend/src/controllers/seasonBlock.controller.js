const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  findOverlappingActiveBlock,
  civilToUtcDate,
  toCivil
} = require('../utils/seasonBlockOverlap');

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

// Función auxiliar para validar fechas (día civil YYYY-MM-DD)
const validateDates = (startDate, endDate) => {
  const start = toCivil(startDate);
  const end = toCivil(endDate);

  if (!start || !end) {
    return 'Las fechas proporcionadas no son válidas';
  }

  if (start >= end) {
    return 'La fecha de inicio debe ser anterior a la fecha de fin';
  }

  return null;
};

const formatOverlapError = (overlappingBlock, prefix = 'Existe superposición con el bloque') => {
  const start = toCivil(overlappingBlock.startDate);
  const end = toCivil(overlappingBlock.endDate);
  const kind = overlappingBlock.isDraft ? 'borrador' : 'confirmado';
  return `${prefix} ${kind} "${overlappingBlock.name}" (${start} - ${end})`;
};

const {
  calculateFinalPrice
} = require('../services/canonicalPricingService');

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
    
    // Obtener el campo isDraft del body
    const isDraft = req.body.isDraft === true || req.body.isDraft === false
      ? req.body.isDraft
      : false;

    // Solo validar fechas si se proporcionan fechas completas
    if (startDate && endDate) {
      const dateValidation = validateDates(startDate, endDate);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }

      // Solo verificar superposición de fechas si NO es un borrador (día civil, solo activos)
      if (!isDraft) {
        const overlappingBlock = await findOverlappingActiveBlock(prisma, {
          hotelId: finalHotelId,
          startDate,
          endDate
        });

        if (overlappingBlock) {
          return res.status(409).json({
            data: null,
            errors: [formatOverlapError(overlappingBlock)],
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
      const trimmedDesc = description?.trim();
      const block = await tx.seasonBlock.create({
        data: {
          name: name.trim(),
          description: trimmedDesc && trimmedDesc.length > 0 ? trimmedDesc : null,
          startDate: civilToUtcDate(startDate),
          endDate: civilToUtcDate(endDate),
          hotelId: finalHotelId,
          serviceAdjustmentMode,
          useBlockServices,
          isDraft: isDraft,
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

    // Fechas efectivas: body si viene, si no las de DB (evita validar fechas viejas al activar)
    const effectiveStart = startDate !== undefined && startDate !== null && startDate !== ''
      ? startDate
      : existingBlock.startDate;
    const effectiveEnd = endDate !== undefined && endDate !== null && endDate !== ''
      ? endDate
      : existingBlock.endDate;

    const willBeActive = isDraft === false
      || (isDraft === undefined && existingBlock.isDraft === false);

    if (effectiveStart && effectiveEnd) {
      const dateValidation = validateDates(effectiveStart, effectiveEnd);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }

      // Solo contra bloques activos; no incluye borradores. Intervalo cerrado por día civil.
      if (willBeActive) {
        const overlappingBlock = await findOverlappingActiveBlock(prisma, {
          hotelId: existingBlock.hotelId,
          excludeId: id,
          startDate: effectiveStart,
          endDate: effectiveEnd
        });

        if (overlappingBlock) {
          console.log('🚨 Superposición detectada:', overlappingBlock.name, {
            effectiveStart: toCivil(effectiveStart),
            effectiveEnd: toCivil(effectiveEnd)
          });
          return res.status(409).json({
            data: null,
            errors: [
              isDraft === false
                ? formatOverlapError(overlappingBlock, 'No se puede activar: las fechas se superponen con el bloque')
                : formatOverlapError(overlappingBlock)
            ],
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
    
    // Actualizar en transacción (guardar cambios reales pero marcados como borrador)
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar el bloque
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) {
        // Limpiar y normalizar la descripción
        const trimmedDesc = description?.trim();
        // Si está vacío o es null, guardar como null
        updateData.description = trimmedDesc && trimmedDesc.length > 0 ? trimmedDesc : null;
      }
      if (startDate !== undefined && startDate !== null && startDate !== '') {
        updateData.startDate = civilToUtcDate(startDate);
      }
      if (endDate !== undefined && endDate !== null && endDate !== '') {
        updateData.endDate = civilToUtcDate(endDate);
      }
      if (serviceAdjustmentMode !== undefined) updateData.serviceAdjustmentMode = serviceAdjustmentMode;
      if (useBlockServices !== undefined) updateData.useBlockServices = useBlockServices;
      
      // 🔧 FIX: Mantener el estado isDraft actual si no se especifica
      // Solo forzar a borrador si es un bloque nuevo o si explícitamente no se envía el campo
      if (isDraft !== undefined) {
        updateData.isDraft = isDraft;
      } else {
        // Si no se especifica isDraft, mantener el estado actual del bloque
        updateData.isDraft = existingBlock.isDraft;
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
    
    // Mismo motor canónico que Consulta / cargos (sin redondeo)
    const calculatedPrices = block.seasonPrices.map(price => {
      const serviceSelection = block.blockServiceSelections.find(
        sel => sel.serviceTypeId === price.serviceTypeId && sel.isEnabled
      );
      const priced = calculateFinalPrice(
        price.basePrice,
        serviceSelection?.percentageAdjustment ?? 0
      );
      
      return {
        ...price,
        calculatedPrice: priced.calculatedPrice,
        roundedPrice: priced.finalPrice,
        wasRounded: false,
        serviceSelection,
        percentageAdjustment: priced.percentageAdjustment,
        currency: 'ARS'
      };
    });
    
    res.json({ 
      data: {
        block,
        calculatedPrices
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
          startDate: newStartDate ? civilToUtcDate(newStartDate) : originalBlock.startDate,
          endDate: newEndDate ? civilToUtcDate(newEndDate) : originalBlock.endDate,
          hotelId: originalBlock.hotelId,
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
    
    // Verificar superposición de fechas con bloques confirmados (día civil)
    const overlappingBlock = await findOverlappingActiveBlock(prisma, {
      hotelId: existingBlock.hotelId,
      excludeId: id,
      startDate: existingBlock.startDate,
      endDate: existingBlock.endDate
    });

    if (overlappingBlock) {
      return res.status(409).json({
        data: null,
        errors: [formatOverlapError(overlappingBlock)],
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
    
    // Confirmar bloque + precios + selecciones (una sola implementación)
    const confirmedBlock = await prisma.$transaction(async (tx) => {
      const block = await tx.seasonBlock.update({
        where: { id },
        data: {
          isDraft: false,
          lastSavedAt: new Date()
        }
      });

      await tx.seasonPrice.updateMany({
        where: { seasonBlockId: id },
        data: { isDraft: false }
      });

      await tx.blockServiceSelection.updateMany({
        where: { seasonBlockId: id },
        data: { isDraft: false }
      });

      return tx.seasonBlock.findUnique({
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
    
    console.log('Block confirmed successfully:', {
      id: confirmedBlock.id,
      name: confirmedBlock.name,
      isDraft: confirmedBlock.isDraft
    });
    
    res.json({ 
      data: confirmedBlock, 
      errors: null,
      message: 'Bloque confirmado. Solo afecta cotizaciones y nuevas reservas; las reservas existentes conservan su snapshot.'
    });
  } catch (error) {
    console.error('Error confirming season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al confirmar el bloque de temporada'] 
    });
  }
};