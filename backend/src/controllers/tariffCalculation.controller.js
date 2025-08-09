const prisma = require('../utils/prisma');

// Calcular tarifas finales para un bloque de temporada específico
exports.calculateSeasonBlockTariffs = async (req, res) => {
  const { seasonBlockId } = req.params;
  const { includeIntelligentPricing = false } = req.query;
  
  try {
    // Obtener el bloque de temporada con todos sus datos
    const seasonBlock = await prisma.seasonBlock.findUnique({
      where: { id: seasonBlockId },
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
    
    // Obtener todos los tipos de servicio para este hotel
    const allServiceTypes = await prisma.serviceType.findMany({
      where: { hotelId: seasonBlock.hotelId, isActive: true },
      orderBy: { orderIndex: 'asc' }
    });
    
    // Crear matriz de tarifas: filas = habitaciones, columnas = servicios
    const tariffMatrix = [];
    
    // Para cada precio base (habitación)
    for (const seasonPrice of seasonBlock.seasonPrices) {
      const roomRow = {
        roomType: seasonPrice.roomType,
        basePrice: seasonPrice.basePrice,
        services: []
      };
      
      // Para cada tipo de servicio
      for (const serviceType of allServiceTypes) {
        // Buscar si hay un ajuste específico para esta habitación y servicio
        const adjustment = seasonBlock.seasonServiceAdjustments.find(
          adj => adj.roomTypeId === seasonPrice.roomTypeId && 
                 adj.serviceTypeId === serviceType.id
        );
        
        let finalPrice = seasonPrice.basePrice;
        let adjustmentValue = 0;
        let adjustmentMode = null;
        
        if (adjustment) {
          adjustmentValue = adjustment.value;
          adjustmentMode = adjustment.mode;
          
          if (adjustment.mode === 'FIXED') {
            finalPrice = seasonPrice.basePrice + adjustment.value;
          } else if (adjustment.mode === 'PERCENTAGE') {
            finalPrice = seasonPrice.basePrice * (1 + adjustment.value / 100);
          }
        }
        
        roomRow.services.push({
          serviceType: {
            id: serviceType.id,
            name: serviceType.name
          },
          basePrice: seasonPrice.basePrice,
          adjustmentValue,
          adjustmentMode,
          finalPrice: Math.round(finalPrice * 100) / 100, // Redondear a 2 decimales
          hasAdjustment: !!adjustment
        });
      }
      
      tariffMatrix.push(roomRow);
    }
    
    const response = {
      seasonBlock: {
        id: seasonBlock.id,
        name: seasonBlock.name,
        description: seasonBlock.description,
        startDate: seasonBlock.startDate,
        endDate: seasonBlock.endDate
      },
      serviceTypes: allServiceTypes,
      tariffMatrix,
      calculationInfo: {
        includeIntelligentPricing,
        calculatedAt: new Date().toISOString(),
        note: includeIntelligentPricing 
          ? 'Precios con sistema inteligente aplicado' 
          : 'Precios base con ajustes por servicio únicamente'
      }
    };
    
    res.json({ data: response, errors: null });
  } catch (error) {
    console.error('Error calculating season block tariffs:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al calcular las tarifas del bloque de temporada'] 
    });
  }
};

// Obtener todas las tarifas para una fecha específica
exports.getTariffsForDate = async (req, res) => {
  const { date, hotelId = 'default-hotel' } = req.query;
  
  try {
    if (!date) {
      return res.status(400).json({ 
        data: null, 
        errors: ['La fecha es requerida'] 
      });
    }
    
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Formato de fecha inválido'] 
      });
    }
    
    // Buscar el bloque de temporada activo para esta fecha
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId,
        isActive: true,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      },
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
        errors: [`No se encontró un bloque de temporada activo para la fecha ${date}`] 
      });
    }
    
    // Reutilizar la lógica de cálculo
    req.params.seasonBlockId = seasonBlock.id;
    return exports.calculateSeasonBlockTariffs(req, res);
    
  } catch (error) {
    console.error('Error getting tariffs for date:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener las tarifas para la fecha especificada'] 
    });
  }
};

// Comparar tarifas entre diferentes bloques de temporada
exports.compareTariffsBetweenBlocks = async (req, res) => {
  const { blockIds } = req.body;
  
  try {
    if (!Array.isArray(blockIds) || blockIds.length < 2) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Se requieren al menos 2 IDs de bloques para comparar'] 
      });
    }
    
    const comparisons = [];
    
    // Obtener datos de cada bloque
    for (const blockId of blockIds) {
      const seasonBlock = await prisma.seasonBlock.findUnique({
        where: { id: blockId },
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
          errors: [`Bloque de temporada con ID ${blockId} no encontrado`] 
        });
      }
      
      comparisons.push({
        block: {
          id: seasonBlock.id,
          name: seasonBlock.name,
          startDate: seasonBlock.startDate,
          endDate: seasonBlock.endDate
        },
        basePrices: seasonBlock.seasonPrices.map(sp => ({
          roomType: sp.roomType,
          basePrice: sp.basePrice
        })),
        adjustments: seasonBlock.seasonServiceAdjustments.map(adj => ({
          serviceType: adj.serviceType,
          roomType: adj.roomType,
          mode: adj.mode,
          value: adj.value
        }))
      });
    }
    
    res.json({ data: { comparisons }, errors: null });
  } catch (error) {
    console.error('Error comparing tariffs between blocks:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al comparar tarifas entre bloques'] 
    });
  }
}; 

// Obtener precios por fecha - matriz de habitaciones x servicios
exports.getPricesByDate = async (req, res) => {
  const { fecha, hotelId = 'default-hotel' } = req.query;
  
  try {
    if (!fecha) {
      return res.status(400).json({ 
        data: null, 
        errors: ['La fecha es requerida (formato: YYYY-MM-DD)'] 
      });
    }
    
    const targetDate = new Date(fecha);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Formato de fecha inválido. Use YYYY-MM-DD'] 
      });
    }
    
    // Buscar el bloque de temporada activo para esta fecha
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId,
        isActive: true,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      },
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
      return res.json({ 
        data: {
          empty: true,
          message: `No se encontró un bloque de temporada activo para la fecha ${fecha}`,
          date: fecha,
          tariffMatrix: [],
          serviceTypes: [],
          roomTypes: []
        }, 
        errors: null 
      });
    }
    
    // Obtener todos los tipos de servicio para este hotel
    const allServiceTypes = await prisma.serviceType.findMany({
      where: { hotelId, isActive: true },
      orderBy: { orderIndex: 'asc' }
    });
    
    // Crear matriz de tarifas: filas = habitaciones, columnas = servicios
    const tariffMatrix = [];
    
    // Para cada precio base (habitación)
    for (const seasonPrice of seasonBlock.seasonPrices) {
      const roomRow = {
        roomType: seasonPrice.roomType,
        basePrice: seasonPrice.basePrice,
        services: []
      };
      
      // Para cada tipo de servicio
      for (const serviceType of allServiceTypes) {
        // Buscar si hay un ajuste específico para esta habitación y servicio
        const adjustment = seasonBlock.seasonServiceAdjustments.find(
          adj => adj.roomTypeId === seasonPrice.roomTypeId && 
                 adj.serviceTypeId === serviceType.id
        );
        
        let finalPrice = seasonPrice.basePrice;
        let adjustmentValue = 0;
        let adjustmentMode = null;
        
        if (adjustment) {
          adjustmentValue = adjustment.value;
          adjustmentMode = adjustment.mode;
          
          if (adjustment.mode === 'FIXED') {
            finalPrice = seasonPrice.basePrice + adjustment.value;
          } else if (adjustment.mode === 'PERCENTAGE') {
            finalPrice = seasonPrice.basePrice * (1 + adjustment.value / 100);
          }
        }
        
        roomRow.services.push({
          serviceType: {
            id: serviceType.id,
            name: serviceType.name
          },
          basePrice: seasonPrice.basePrice,
          adjustmentValue,
          adjustmentMode,
          finalPrice: Math.round(finalPrice * 100) / 100, // Redondear a 2 decimales
          hasAdjustment: !!adjustment
        });
      }
      
      tariffMatrix.push(roomRow);
    }
    
    const response = {
      empty: false,
      date: fecha,
      seasonBlock: {
        id: seasonBlock.id,
        name: seasonBlock.name,
        description: seasonBlock.description,
        startDate: seasonBlock.startDate,
        endDate: seasonBlock.endDate
      },
      serviceTypes: allServiceTypes,
      roomTypes: seasonBlock.seasonPrices.map(sp => sp.roomType),
      tariffMatrix,
      calculationInfo: {
        calculatedAt: new Date().toISOString(),
        note: 'Precios base con ajustes por servicio únicamente (sin precios inteligentes)'
      }
    };
    
    res.json({ data: response, errors: null });
  } catch (error) {
    console.error('Error getting prices by date:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener los precios para la fecha especificada'] 
    });
  }
}; 