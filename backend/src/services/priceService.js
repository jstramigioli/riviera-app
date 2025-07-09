const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Obtiene el precio para una fecha específica
 * @param {Date} date - La fecha para la cual obtener el precio
 * @returns {Promise<number|null>} - El precio en centavos o null si el hotel está cerrado
 */
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

/**
 * Obtiene el precio para un tipo de habitación específico en una fecha
 * @param {Date} date - La fecha para la cual obtener el precio
 * @param {number} roomTypeId - El ID del tipo de habitación
 * @returns {Promise<number|null>} - El precio en centavos o null si el hotel está cerrado
 */
const getPriceForRoomType = async (date, roomTypeId) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Consultar si el día está habilitado
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
    
    // Obtener el tipo de habitación con su multiplicador
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId }
    });
    
    if (!roomType) {
      throw new Error(`Tipo de habitación con ID ${roomTypeId} no encontrado`);
    }
    
    // Determinar el precio base
    let basePrice;
    if (openDay.fixedPrice !== null) {
      basePrice = openDay.fixedPrice;
    } else {
      basePrice = calculateDynamicBasePrice(targetDate);
    }
    
    // Calcular el precio final aplicando el multiplicador
    const finalPrice = Math.round(basePrice * roomType.multiplier);
    
    return finalPrice;
  } catch (error) {
    console.error('Error getting price for room type:', error);
    throw error;
  }
};

/**
 * Calcula el precio base dinámico (sin multiplicadores de tipo de habitación)
 * @param {Date} date - La fecha para calcular el precio base
 * @returns {number} - El precio base en centavos
 */
const calculateDynamicBasePrice = (date) => {
  // Precio base de $50 USD (5000 centavos)
  const basePrice = 5000;
  
  // Lógica de precios por temporada
  const month = date.getMonth() + 1; // getMonth() retorna 0-11
  const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
  
  let multiplier = 1.0;
  
  // Temporada alta (diciembre a marzo)
  if (month >= 12 || month <= 3) {
    multiplier = 1.5;
  }
  // Temporada media (abril, mayo, octubre, noviembre)
  else if (month === 4 || month === 5 || month === 10 || month === 11) {
    multiplier = 1.2;
  }
  // Temporada baja (junio a septiembre)
  else {
    multiplier = 1.0;
  }
  
  // Ajuste por fin de semana
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o sábado
    multiplier *= 1.1; // 10% adicional en fin de semana
  }
  
  // Ajuste por feriados (ejemplo básico)
  const isHoliday = checkIfHoliday(date);
  if (isHoliday) {
    multiplier *= 1.3; // 30% adicional en feriados
  }
  
  return Math.round(basePrice * multiplier);
};

/**
 * Calcula el precio dinámico basado en la fecha (mantiene compatibilidad)
 * @param {Date} date - La fecha para calcular el precio
 * @returns {number} - El precio en centavos
 */
const calculateDynamicPrice = (date) => {
  return calculateDynamicBasePrice(date);
};

/**
 * Verifica si una fecha es feriado (función stub)
 * @param {Date} date - La fecha a verificar
 * @returns {boolean} - true si es feriado
 */
const checkIfHoliday = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Feriados básicos de Argentina (ejemplo)
  const holidays = [
    { month: 1, day: 1 },   // Año Nuevo
    { month: 5, day: 1 },   // Día del Trabajador
    { month: 5, day: 25 },  // Revolución de Mayo
    { month: 7, day: 9 },   // Día de la Independencia
    { month: 12, day: 25 }, // Navidad
  ];
  
  return holidays.some(holiday => holiday.month === month && holiday.day === day);
};

/**
 * Obtiene precios para un rango de fechas
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {Promise<Array>} - Array de objetos con fecha y precio
 */
const getPricesForDateRange = async (startDate, endDate) => {
  try {
    const prices = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const price = await getPriceForDate(currentDate);
      prices.push({
        date: new Date(currentDate),
        price: price,
        isOpen: price !== null
      });
      
      // Avanzar al siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return prices;
  } catch (error) {
    console.error('Error getting prices for date range:', error);
    throw error;
  }
};

/**
 * Verifica si el hotel está abierto en una fecha específica
 * @param {Date} date - La fecha a verificar
 * @returns {Promise<boolean>} - true si está abierto
 */
const isHotelOpen = async (date) => {
  try {
    const price = await getPriceForDate(date);
    return price !== null;
  } catch (error) {
    console.error('Error checking if hotel is open:', error);
    throw error;
  }
};

/**
 * Obtiene estadísticas de precios para un período
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {Promise<Object>} - Estadísticas de precios
 */
const getPriceStatistics = async (startDate, endDate) => {
  try {
    const prices = await getPricesForDateRange(startDate, endDate);
    const openDays = prices.filter(p => p.isOpen);
    
    if (openDays.length === 0) {
      return {
        totalDays: prices.length,
        openDays: 0,
        closedDays: prices.length,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalRevenue: 0
      };
    }
    
    const priceValues = openDays.map(p => p.price);
    const totalRevenue = priceValues.reduce((sum, price) => sum + price, 0);
    
    return {
      totalDays: prices.length,
      openDays: openDays.length,
      closedDays: prices.length - openDays.length,
      averagePrice: Math.round(totalRevenue / openDays.length),
      minPrice: Math.min(...priceValues),
      maxPrice: Math.max(...priceValues),
      totalRevenue: totalRevenue
    };
  } catch (error) {
    console.error('Error getting price statistics:', error);
    throw error;
  }
};

/**
 * Obtiene precios para un rango de fechas por tipo de habitación
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @param {number} roomTypeId - ID del tipo de habitación
 * @returns {Promise<Array>} - Array de objetos con fecha y precio
 */
const getPricesForRoomTypeInRange = async (startDate, endDate, roomTypeId) => {
  try {
    const prices = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const price = await getPriceForRoomType(currentDate, roomTypeId);
      prices.push({
        date: new Date(currentDate),
        price: price,
        isOpen: price !== null,
        roomTypeId: roomTypeId
      });
      
      // Avanzar al siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return prices;
  } catch (error) {
    console.error('Error getting prices for room type in range:', error);
    throw error;
  }
};

/**
 * Obtiene precios para todos los tipos de habitación en una fecha específica
 * @param {Date} date - La fecha para obtener los precios
 * @returns {Promise<Array>} - Array de objetos con roomTypeId y precio
 */
const getPricesForAllRoomTypes = async (date) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Consultar si el día está habilitado
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
      return [];
    }
    
    // Obtener todos los tipos de habitación
    const roomTypes = await prisma.roomType.findMany();
    
    const prices = [];
    for (const roomType of roomTypes) {
      const price = await getPriceForRoomType(targetDate, roomType.id);
      prices.push({
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        multiplier: roomType.multiplier,
        price: price,
        priceInDollars: price ? (price / 100).toFixed(2) : null,
        isOpen: price !== null
      });
    }
    
    return prices;
  } catch (error) {
    console.error('Error getting prices for all room types:', error);
    throw error;
  }
};

module.exports = {
  getPriceForDate,
  getPriceForRoomType,
  calculateDynamicPrice,
  calculateDynamicBasePrice,
  getPricesForDateRange,
  getPricesForRoomTypeInRange,
  getPricesForAllRoomTypes,
  isHotelOpen,
  getPriceStatistics,
  checkIfHoliday
}; 