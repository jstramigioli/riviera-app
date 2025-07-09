const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const priceService = require('../services/priceService');

// Obtener todos los días abiertos
const getAllOpenDays = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        whereClause.date = {
          gte: start,
          lte: end
        };
      }
    }
    
    console.log('Getting open days with filter:', whereClause);
    
    const openDays = await prisma.openDay.findMany({
      where: whereClause,
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log('Found open days:', openDays.length);
    res.json(openDays);
  } catch (error) {
    console.error('Error getting open days:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener un día abierto por ID
const getOpenDayById = async (req, res) => {
  try {
    const { id } = req.params;
    const openDay = await prisma.openDay.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!openDay) {
      return res.status(404).json({ error: 'Día abierto no encontrado' });
    }
    
    res.json(openDay);
  } catch (error) {
    console.error('Error getting open day:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener un día abierto por fecha
const getOpenDayByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    // Normalizar la fecha para buscar solo por día (sin hora)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const openDay = await prisma.openDay.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    if (!openDay) {
      return res.status(404).json({ error: 'El hotel está cerrado en esta fecha' });
    }
    
    res.json(openDay);
  } catch (error) {
    console.error('Error getting open day by date:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear un nuevo día abierto
const createOpenDay = async (req, res) => {
  try {
    const { date, isClosed, isHoliday, fixedPrice, notes, roomTypePrices } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'La fecha es requerida' });
    }
    
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    // Normalizar la fecha para almacenar solo el día
    targetDate.setHours(0, 0, 0, 0);
    
    // Verificar si ya existe un día abierto para esa fecha
    const existingOpenDay = await prisma.openDay.findFirst({
      where: {
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });
    
    if (existingOpenDay) {
      return res.status(409).json({ error: 'Ya existe un día abierto para esta fecha' });
    }
    
    const openDay = await prisma.openDay.create({
      data: {
        date: targetDate,
        isClosed: isClosed !== undefined ? isClosed : true,
        isHoliday: isHoliday || false,
        fixedPrice: fixedPrice ? parseInt(fixedPrice) : null,
        notes: notes || null
      }
    });
    
    // Si hay precios personalizados por tipo de habitación, guardarlos
    if (roomTypePrices && Array.isArray(roomTypePrices)) {
      for (const roomTypePrice of roomTypePrices) {
        if (roomTypePrice.useFixedPrice && roomTypePrice.fixedPrice) {
          await prisma.dailyRate.upsert({
            where: {
              date_roomTypeId: {
                date: targetDate,
                roomTypeId: roomTypePrice.roomTypeId
              }
            },
            update: {
              price: roomTypePrice.fixedPrice / 100 // Convertir de centavos a dólares
            },
            create: {
              date: targetDate,
              roomTypeId: roomTypePrice.roomTypeId,
              price: roomTypePrice.fixedPrice / 100
            }
          });
        }
      }
    }
    
    res.status(201).json(openDay);
  } catch (error) {
    console.error('Error creating open day:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar un día abierto por fecha
const updateOpenDayByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { isClosed, isHoliday, fixedPrice, notes, roomTypePrices } = req.body;
    
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    // Normalizar la fecha para buscar solo por día
    targetDate.setHours(0, 0, 0, 0);
    
    const openDay = await prisma.openDay.findFirst({
      where: {
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });
    
    if (!openDay) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }
    
    const updateData = {};
    
    if (isClosed !== undefined) {
      updateData.isClosed = isClosed;
    }
    
    if (isHoliday !== undefined) {
      updateData.isHoliday = isHoliday;
    }
    
    if (fixedPrice !== undefined) {
      updateData.fixedPrice = fixedPrice ? parseInt(fixedPrice) : null;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }
    
    const updatedOpenDay = await prisma.openDay.update({
      where: { id: openDay.id },
      data: updateData
    });
    
    // Si hay precios personalizados por tipo de habitación, actualizarlos
    if (roomTypePrices && Array.isArray(roomTypePrices)) {
      for (const roomTypePrice of roomTypePrices) {
        if (roomTypePrice.useFixedPrice && roomTypePrice.fixedPrice) {
          await prisma.dailyRate.upsert({
            where: {
              date_roomTypeId: {
                date: updatedOpenDay.date,
                roomTypeId: roomTypePrice.roomTypeId
              }
            },
            update: {
              price: roomTypePrice.fixedPrice / 100 // Convertir de centavos a dólares
            },
            create: {
              date: updatedOpenDay.date,
              roomTypeId: roomTypePrice.roomTypeId,
              price: roomTypePrice.fixedPrice / 100
            }
          });
        } else {
          // Si no se usa precio fijo, eliminar el registro si existe
          await prisma.dailyRate.deleteMany({
            where: {
              date: updatedOpenDay.date,
              roomTypeId: roomTypePrice.roomTypeId
            }
          });
        }
      }
    }
    
    res.json(updatedOpenDay);
  } catch (error) {
    console.error('Error updating open day by date:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar un día abierto por ID
const updateOpenDay = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, isClosed, isHoliday, fixedPrice, notes, roomTypePrices } = req.body;
    
    const openDay = await prisma.openDay.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!openDay) {
      return res.status(404).json({ error: 'Día abierto no encontrado' });
    }
    
    const updateData = {};
    
    if (date) {
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Fecha inválida' });
      }
      targetDate.setHours(0, 0, 0, 0);
      updateData.date = targetDate;
    }
    
    if (isClosed !== undefined) {
      updateData.isClosed = isClosed;
    }
    
    if (isHoliday !== undefined) {
      updateData.isHoliday = isHoliday;
    }
    
    if (fixedPrice !== undefined) {
      updateData.fixedPrice = fixedPrice ? parseInt(fixedPrice) : null;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }
    
    const updatedOpenDay = await prisma.openDay.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    // Si hay precios personalizados por tipo de habitación, actualizarlos
    if (roomTypePrices && Array.isArray(roomTypePrices)) {
      for (const roomTypePrice of roomTypePrices) {
        if (roomTypePrice.useFixedPrice && roomTypePrice.fixedPrice) {
          await prisma.dailyRate.upsert({
            where: {
              date_roomTypeId: {
                date: updatedOpenDay.date,
                roomTypeId: roomTypePrice.roomTypeId
              }
            },
            update: {
              price: roomTypePrice.fixedPrice / 100 // Convertir de centavos a dólares
            },
            create: {
              date: updatedOpenDay.date,
              roomTypeId: roomTypePrice.roomTypeId,
              price: roomTypePrice.fixedPrice / 100
            }
          });
        } else {
          // Si no se usa precio fijo, eliminar el registro si existe
          await prisma.dailyRate.deleteMany({
            where: {
              date: updatedOpenDay.date,
              roomTypeId: roomTypePrice.roomTypeId
            }
          });
        }
      }
    }
    
    res.json(updatedOpenDay);
  } catch (error) {
    console.error('Error updating open day:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar un día abierto
const deleteOpenDay = async (req, res) => {
  try {
    const { id } = req.params;
    
    const openDay = await prisma.openDay.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!openDay) {
      return res.status(404).json({ error: 'Día abierto no encontrado' });
    }
    
    await prisma.openDay.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Día abierto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting open day:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Endpoint para obtener el precio de una fecha específica
const getPriceForDateEndpoint = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    const price = await priceService.getPriceForDate(targetDate);
    
    if (price === null) {
      return res.status(404).json({ 
        error: 'Hotel cerrado',
        message: 'El hotel está cerrado en esta fecha'
      });
    }
    
    res.json({
      date: targetDate.toISOString().split('T')[0],
      price: price,
      priceInDollars: (price / 100).toFixed(2),
      isOpen: true
    });
  } catch (error) {
    console.error('Error getting price for date:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Endpoint para obtener el precio de un tipo de habitación en una fecha específica
const getPriceForRoomTypeEndpoint = async (req, res) => {
  try {
    const { date, roomTypeId } = req.params;
    const targetDate = new Date(date);
    const roomTypeIdNum = parseInt(roomTypeId);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    if (isNaN(roomTypeIdNum)) {
      return res.status(400).json({ error: 'ID de tipo de habitación inválido' });
    }
    
    const price = await priceService.getPriceForRoomType(targetDate, roomTypeIdNum);
    
    if (price === null) {
      return res.status(404).json({ 
        error: 'Hotel cerrado',
        message: 'El hotel está cerrado en esta fecha'
      });
    }
    
    res.json({
      date: targetDate.toISOString().split('T')[0],
      roomTypeId: roomTypeIdNum,
      price: price,
      priceInDollars: (price / 100).toFixed(2),
      isOpen: true
    });
  } catch (error) {
    console.error('Error getting price for room type:', error);
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Endpoint para obtener precios de todos los tipos de habitación en una fecha
const getPricesForAllRoomTypesEndpoint = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    const prices = await priceService.getPricesForAllRoomTypes(targetDate);
    
    res.json({
      date: targetDate.toISOString().split('T')[0],
      prices: prices,
      isOpen: prices.length > 0
    });
  } catch (error) {
    console.error('Error getting prices for all room types:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Función para obtener el precio de una fecha específica
const getPriceForDate = async (date) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const openDay = await prisma.openDay.findFirst({
      where: {
        date: {
          gte: targetDate,
          lte: endOfDay
        }
      }
    });
    
    // Si no existe el día, el hotel está cerrado
    if (!openDay) {
      return null;
    }
    
    // Si hay precio fijo, retornarlo
    if (openDay.fixedPrice !== null) {
      return openDay.fixedPrice; // Retorna en centavos
    }
    
    // Si no hay precio fijo, calcular precio dinámico
    return calculateDynamicPrice(targetDate);
  } catch (error) {
    console.error('Error getting price for date:', error);
    throw error;
  }
};

// Función stub para calcular precio dinámico
const calculateDynamicPrice = (date) => {
  // TODO: Implementar lógica de precios dinámicos
  // Por ahora, retorna un precio base de $50 USD (5000 centavos)
  const basePrice = 5000; // $50 USD en centavos
  
  // Lógica básica de precios por temporada
  const month = date.getMonth() + 1; // getMonth() retorna 0-11
  
  // Temporada alta (diciembre a marzo)
  if (month >= 12 || month <= 3) {
    return Math.round(basePrice * 1.5); // 50% más caro
  }
  
  // Temporada media (abril, mayo, octubre, noviembre)
  if (month === 4 || month === 5 || month === 10 || month === 11) {
    return Math.round(basePrice * 1.2); // 20% más caro
  }
  
  // Temporada baja (junio a septiembre)
  return basePrice;
};

module.exports = {
  getAllOpenDays,
  getOpenDayById,
  getOpenDayByDate,
  createOpenDay,
  updateOpenDay,
  updateOpenDayByDate,
  deleteOpenDay,
  getPriceForDate,
  getPriceForDateEndpoint,
  getPriceForRoomTypeEndpoint,
  getPricesForAllRoomTypesEndpoint
}; 