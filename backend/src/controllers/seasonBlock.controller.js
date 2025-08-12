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
    
    const dateValidation = validateDates(startDate, endDate);
    if (dateValidation) {
      return res.status(400).json({ 
        data: null, 
        errors: [dateValidation] 
      });
    }
    
    // Verificar que no haya otro bloque con el mismo nombre
    const existingBlock = await prisma.seasonBlock.findFirst({
      where: { 
        hotelId: finalHotelId,
        name: name.trim()
      }
    });
    
    if (existingBlock) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Ya existe un bloque con ese nombre'] 
      });
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

// Actualizar bloque de temporada
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
      prices = [],
      blockServiceSelections = []
    } = req.body;
    
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
    
    // Validar fechas si se proporcionan
    if (startDate && endDate) {
      const dateValidation = validateDates(startDate, endDate);
      if (dateValidation) {
        return res.status(400).json({ 
          data: null, 
          errors: [dateValidation] 
        });
      }
    }
    
    // Actualizar en transacción
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
      
      const block = await tx.seasonBlock.update({
        where: { id },
        data: updateData
      });
      
      // Actualizar precios
      if (prices.length > 0) {
        // Eliminar precios existentes
        await tx.seasonPrice.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevos precios
        for (const price of prices) {
          await tx.seasonPrice.create({
            data: {
              seasonBlockId: id,
              roomTypeId: price.roomTypeId,
              serviceTypeId: price.serviceTypeId,
              basePrice: parseFloat(price.basePrice) || 0
            }
          });
        }
      }
      
      // Actualizar selecciones de servicios
      if (blockServiceSelections && blockServiceSelections.length > 0) {
        // Eliminar selecciones existentes
        await tx.blockServiceSelection.deleteMany({
          where: { seasonBlockId: id }
        });
        
        // Crear nuevas selecciones
        for (const selection of blockServiceSelections) {
          await tx.blockServiceSelection.create({
            data: {
              seasonBlockId: id,
              serviceTypeId: selection.serviceTypeId,
              isEnabled: selection.isEnabled ?? true,
              orderIndex: selection.orderIndex || 0,
              percentageAdjustment: selection.percentageAdjustment ?? 0
            }
          });
        }
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
      
      // Los ajustes de precio ahora se manejan a nivel de bloque, no de servicio individual
      // El precio base ya incluye los ajustes aplicados
      
      // Aplicar redondeo
      const roundedPrice = applyRounding(finalPrice, roundingConfig);
      
      return {
        ...price,
        calculatedPrice: finalPrice,
        roundedPrice: roundedPrice,
        wasRounded: Math.abs(finalPrice - roundedPrice) > 0.01,
        serviceSelection
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