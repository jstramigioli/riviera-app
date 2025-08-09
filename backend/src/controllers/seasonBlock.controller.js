const prisma = require('../utils/prisma');

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

// Función auxiliar para validar ajustes por servicio
const validateServiceAdjustments = (adjustments) => {
  if (!Array.isArray(adjustments)) {
    return 'Los ajustes por servicio deben ser un array';
  }
  
  for (const adjustment of adjustments) {
    const { mode, value, serviceTypeId, roomTypeId } = adjustment;
    
    if (!serviceTypeId || !roomTypeId) {
      return 'Cada ajuste debe tener serviceTypeId y roomTypeId';
    }
    
    if (!mode || !['FIXED', 'PERCENTAGE'].includes(mode)) {
      return 'El modo del ajuste debe ser FIXED o PERCENTAGE';
    }
    
    if (typeof value !== 'number') {
      return 'El valor del ajuste debe ser un número';
    }
    
    if (mode === 'FIXED' && value < 0) {
      return 'Los montos fijos deben ser mayor o igual a 0';
    }
    
    if (mode === 'PERCENTAGE' && (value < -100 || value > 500)) {
      return 'Los porcentajes deben estar entre -100 y 500';
    }
  }
  
  return null;
};

// Función auxiliar para validar precios base
const validateSeasonPrices = (prices) => {
  if (!Array.isArray(prices)) {
    return 'Los precios base deben ser un array';
  }
  
  for (const price of prices) {
    const { roomTypeId, basePrice } = price;
    
    if (!roomTypeId) {
      return 'Cada precio debe tener roomTypeId';
    }
    
    if (typeof basePrice !== 'number' || basePrice < 0) {
      return 'Los precios base deben ser números mayores o iguales a 0';
    }
  }
  
  return null;
};

// Función auxiliar para verificar solapamientos
const checkBlockOverlaps = async (hotelId, startDate, endDate, excludeId = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const overlappingBlocks = await prisma.seasonBlock.findMany({
    where: {
      hotelId,
      id: excludeId ? { not: excludeId } : undefined,
      isActive: true,
      OR: [
        // El nuevo bloque empieza durante un bloque existente
        {
          AND: [
            { startDate: { lte: start } },
            { endDate: { gt: start } }
          ]
        },
        // El nuevo bloque termina durante un bloque existente
        {
          AND: [
            { startDate: { lt: end } },
            { endDate: { gte: end } }
          ]
        },
        // El nuevo bloque contiene completamente un bloque existente
        {
          AND: [
            { startDate: { gte: start } },
            { endDate: { lte: end } }
          ]
        }
      ]
    }
  });
  
  return overlappingBlocks;
};

// Listar todos los bloques de temporada
exports.getAllSeasonBlocks = async (req, res) => {
  try {
    const { hotelId = 'default-hotel', includeInactive = false } = req.query;
    
    const whereClause = { hotelId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: whereClause,
      include: {
        seasonPrices: {
          include: {
            roomType: {
              select: { id: true, name: true, multiplier: true }
            }
          }
        },
        seasonServiceAdjustments: {
          include: {
            serviceType: {
              select: { id: true, name: true }
            },
            roomType: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: seasonBlocks, errors: null });
  } catch (error) {
    console.error('Error fetching season blocks:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener los bloques de temporada'] 
    });
  }
};

// Obtener un bloque de temporada específico
exports.getSeasonBlockById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const seasonBlock = await prisma.seasonBlock.findUnique({
      where: { id },
      include: {
        seasonPrices: {
          include: {
            roomType: {
              select: { id: true, name: true, multiplier: true }
            }
          }
        },
        seasonServiceAdjustments: {
          include: {
            serviceType: {
              select: { id: true, name: true }
            },
            roomType: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    if (!seasonBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    res.json({ data: seasonBlock, errors: null });
  } catch (error) {
    console.error('Error fetching season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener el bloque de temporada'] 
    });
  }
};

// Crear un nuevo bloque de temporada
exports.createSeasonBlock = async (req, res) => {
  const { 
    name, 
    description, 
    startDate, 
    endDate, 
    hotelId = 'default-hotel',
    orderIndex,
    seasonPrices = [],
    seasonServiceAdjustments = [],
    checkOverlaps = true
  } = req.body;
  
  try {
    // Validaciones básicas
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre del bloque es requerido'] 
      });
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Las fechas de inicio y fin son requeridas'] 
      });
    }
    
    // Validar fechas
    const dateError = validateDates(startDate, endDate);
    if (dateError) {
      return res.status(400).json({ 
        data: null, 
        errors: [dateError] 
      });
    }
    
    // Validar precios base
    const pricesError = validateSeasonPrices(seasonPrices);
    if (pricesError) {
      return res.status(400).json({ 
        data: null, 
        errors: [pricesError] 
      });
    }
    
    // Validar ajustes por servicio
    const adjustmentsError = validateServiceAdjustments(seasonServiceAdjustments);
    if (adjustmentsError) {
      return res.status(400).json({ 
        data: null, 
        errors: [adjustmentsError] 
      });
    }
    
    // Verificar solapamientos si está habilitado
    if (checkOverlaps) {
      const overlaps = await checkBlockOverlaps(hotelId, startDate, endDate);
      if (overlaps.length > 0) {
        const overlapNames = overlaps.map(block => block.name).join(', ');
        return res.status(400).json({ 
          data: null, 
          errors: [`El bloque se solapa con los siguientes bloques existentes: ${overlapNames}`] 
        });
      }
    }
    
    // Verificar que no existe otro bloque con el mismo nombre
    const existingBlock = await prisma.seasonBlock.findFirst({
      where: { 
        hotelId,
        name: name.trim()
      }
    });
    
    if (existingBlock) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Ya existe un bloque con ese nombre'] 
      });
    }
    
    // Verificar que existen los tipos de habitación y servicios referenciados
    const roomTypeIds = [...new Set(seasonPrices.map(p => p.roomTypeId))];
    const serviceTypeIds = [...new Set(seasonServiceAdjustments.map(a => a.serviceTypeId))];
    const adjustmentRoomTypeIds = [...new Set(seasonServiceAdjustments.map(a => a.roomTypeId))];
    const allRoomTypeIds = [...new Set([...roomTypeIds, ...adjustmentRoomTypeIds])];
    
    if (allRoomTypeIds.length > 0) {
      const existingRoomTypes = await prisma.roomType.findMany({
        where: { id: { in: allRoomTypeIds } }
      });
      
      const missingRoomTypes = allRoomTypeIds.filter(
        id => !existingRoomTypes.find(rt => rt.id === id)
      );
      
      if (missingRoomTypes.length > 0) {
        return res.status(400).json({ 
          data: null, 
          errors: [`Los siguientes tipos de habitación no existen: ${missingRoomTypes.join(', ')}`] 
        });
      }
    }
    
    if (serviceTypeIds.length > 0) {
      const existingServiceTypes = await prisma.serviceType.findMany({
        where: { id: { in: serviceTypeIds } }
      });
      
      const missingServiceTypes = serviceTypeIds.filter(
        id => !existingServiceTypes.find(st => st.id === id)
      );
      
      if (missingServiceTypes.length > 0) {
        return res.status(400).json({ 
          data: null, 
          errors: [`Los siguientes tipos de servicio no existen: ${missingServiceTypes.join(', ')}`] 
        });
      }
    }
    
    // Obtener el siguiente orderIndex si no se especifica
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const lastBlock = await prisma.seasonBlock.findFirst({
        where: { hotelId },
        orderBy: { orderIndex: 'desc' }
      });
      finalOrderIndex = (lastBlock?.orderIndex || 0) + 1;
    }
    
    // Crear el bloque de temporada con transacción
    const result = await prisma.$transaction(async (prisma) => {
      // Crear el bloque
      const seasonBlock = await prisma.seasonBlock.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          hotelId,
          orderIndex: finalOrderIndex
        }
      });
      
      // Crear precios base
      if (seasonPrices.length > 0) {
        await prisma.seasonPrice.createMany({
          data: seasonPrices.map(price => ({
            seasonBlockId: seasonBlock.id,
            roomTypeId: price.roomTypeId,
            basePrice: price.basePrice
          }))
        });
      }
      
      // Crear ajustes por servicio
      if (seasonServiceAdjustments.length > 0) {
        await prisma.seasonServiceAdjustment.createMany({
          data: seasonServiceAdjustments.map(adjustment => ({
            seasonBlockId: seasonBlock.id,
            serviceTypeId: adjustment.serviceTypeId,
            roomTypeId: adjustment.roomTypeId,
            mode: adjustment.mode,
            value: adjustment.value
          }))
        });
      }
      
      // Obtener el bloque creado con todas sus relaciones
      return await prisma.seasonBlock.findUnique({
        where: { id: seasonBlock.id },
        include: {
          seasonPrices: {
            include: {
              roomType: {
                select: { id: true, name: true, multiplier: true }
              }
            }
          },
          seasonServiceAdjustments: {
            include: {
              serviceType: {
                select: { id: true, name: true }
              },
              roomType: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });
    });
    
    res.status(201).json({ data: result, errors: null });
  } catch (error) {
    console.error('Error creating season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al crear el bloque de temporada'] 
    });
  }
};

// Actualizar un bloque de temporada
exports.updateSeasonBlock = async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    startDate, 
    endDate, 
    orderIndex,
    isActive,
    seasonPrices = [],
    seasonServiceAdjustments = [],
    checkOverlaps = true
  } = req.body;
  
  try {
    // Verificar que existe
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Validaciones
    if (name !== undefined && (!name || name.trim() === '')) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre del bloque es requerido'] 
      });
    }
    
    // Validar fechas si se proporcionan
    const finalStartDate = startDate || existingBlock.startDate;
    const finalEndDate = endDate || existingBlock.endDate;
    
    const dateError = validateDates(finalStartDate, finalEndDate);
    if (dateError) {
      return res.status(400).json({ 
        data: null, 
        errors: [dateError] 
      });
    }
    
    // Validar precios base si se proporcionan
    if (seasonPrices.length > 0) {
      const pricesError = validateSeasonPrices(seasonPrices);
      if (pricesError) {
        return res.status(400).json({ 
          data: null, 
          errors: [pricesError] 
        });
      }
    }
    
    // Validar ajustes por servicio si se proporcionan
    if (seasonServiceAdjustments.length > 0) {
      const adjustmentsError = validateServiceAdjustments(seasonServiceAdjustments);
      if (adjustmentsError) {
        return res.status(400).json({ 
          data: null, 
          errors: [adjustmentsError] 
        });
      }
    }
    
    // Verificar solapamientos si se cambian las fechas
    if ((startDate || endDate) && checkOverlaps) {
      const overlaps = await checkBlockOverlaps(
        existingBlock.hotelId, 
        finalStartDate, 
        finalEndDate, 
        id
      );
      if (overlaps.length > 0) {
        const overlapNames = overlaps.map(block => block.name).join(', ');
        return res.status(400).json({ 
          data: null, 
          errors: [`El bloque se solapa con los siguientes bloques existentes: ${overlapNames}`] 
        });
      }
    }
    
    // Verificar nombre único si se cambia
    if (name && name.trim() !== existingBlock.name) {
      const duplicateBlock = await prisma.seasonBlock.findFirst({
        where: { 
          hotelId: existingBlock.hotelId,
          name: name.trim(),
          id: { not: id }
        }
      });
      
      if (duplicateBlock) {
        return res.status(400).json({ 
          data: null, 
          errors: ['Ya existe un bloque con ese nombre'] 
        });
      }
    }
    
    // Actualizar con transacción
    const result = await prisma.$transaction(async (prisma) => {
      // Actualizar datos básicos del bloque
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const seasonBlock = await prisma.seasonBlock.update({
        where: { id },
        data: updateData
      });
      
      // Actualizar precios base si se proporcionan
      if (seasonPrices.length > 0) {
        // Eliminar precios existentes
        await prisma.seasonPrice.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevos precios
        await prisma.seasonPrice.createMany({
          data: seasonPrices.map(price => ({
            seasonBlockId: id,
            roomTypeId: price.roomTypeId,
            basePrice: price.basePrice
          }))
        });
      }
      
      // Actualizar ajustes por servicio si se proporcionan
      if (seasonServiceAdjustments.length > 0) {
        // Eliminar ajustes existentes
        await prisma.seasonServiceAdjustment.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevos ajustes
        await prisma.seasonServiceAdjustment.createMany({
          data: seasonServiceAdjustments.map(adjustment => ({
            seasonBlockId: id,
            serviceTypeId: adjustment.serviceTypeId,
            roomTypeId: adjustment.roomTypeId,
            mode: adjustment.mode,
            value: adjustment.value
          }))
        });
      }
      
      // Obtener el bloque actualizado con todas sus relaciones
      return await prisma.seasonBlock.findUnique({
        where: { id },
        include: {
          seasonPrices: {
            include: {
              roomType: {
                select: { id: true, name: true, multiplier: true }
              }
            }
          },
          seasonServiceAdjustments: {
            include: {
              serviceType: {
                select: { id: true, name: true }
              },
              roomType: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });
    });
    
    res.json({ data: result, errors: null });
  } catch (error) {
    console.error('Error updating season block:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el bloque de temporada'] 
    });
  }
};

// Eliminar un bloque de temporada
exports.deleteSeasonBlock = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar que existe
    const existingBlock = await prisma.seasonBlock.findUnique({
      where: { id }
    });
    
    if (!existingBlock) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Bloque de temporada no encontrado'] 
      });
    }
    
    // Eliminar el bloque (cascade eliminará precios y ajustes automáticamente)
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

// Actualizar el orden de los bloques de temporada
exports.updateSeasonBlocksOrder = async (req, res) => {
  const { seasonBlocks } = req.body;
  const { hotelId = 'default-hotel' } = req.query;
  
  try {
    if (!Array.isArray(seasonBlocks)) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Se requiere un array de bloques de temporada'] 
      });
    }
    
    // Actualizar el orden de cada bloque
    const updatePromises = seasonBlocks.map((item, index) => 
      prisma.seasonBlock.update({
        where: { 
          id: item.id,
          hotelId 
        },
        data: { orderIndex: index + 1 }
      })
    );
    
    await Promise.all(updatePromises);
    
    // Obtener los bloques actualizados
    const updatedBlocks = await prisma.seasonBlock.findMany({
      where: { hotelId },
      include: {
        seasonPrices: {
          include: {
            roomType: {
              select: { id: true, name: true, multiplier: true }
            }
          }
        },
        seasonServiceAdjustments: {
          include: {
            serviceType: {
              select: { id: true, name: true }
            },
            roomType: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: updatedBlocks, errors: null });
  } catch (error) {
    console.error('Error updating season blocks order:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el orden de los bloques de temporada'] 
    });
  }
}; 