const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/alojamiento/combinaciones - Obtener todas las combinaciones de roomType + serviceType
const getCombinacionesAlojamiento = async (req, res) => {
  try {
    const [roomTypes, serviceTypes] = await Promise.all([
      prisma.roomType.findMany({
        orderBy: { orderIndex: 'asc' }
      }),
      prisma.serviceType.findMany({
        where: { isActive: true },
        orderBy: { orderIndex: 'asc' }
      })
    ]);

    // Generar todas las combinaciones dinámicamente
    const combinaciones = [];
    for (const roomType of roomTypes) {
      for (const serviceType of serviceTypes) {
        combinaciones.push({
          id: `${roomType.id}_${serviceType.id}`, // ID compuesto para identificación
          roomTypeId: roomType.id,
          serviceTypeId: serviceType.id,
          roomTypeName: roomType.name,
          serviceTypeName: serviceType.name,
          nombre: `${roomType.name} - ${serviceType.name}`,
          descripcion: `Alojamiento en ${roomType.name} con ${serviceType.name}`,
          color: '#4caf50', // Color fijo para alojamiento
          tipo: 'ALOJAMIENTO',
          esDinamico: true
        });
      }
    }

    res.json({
      success: true,
      data: {
        combinaciones: combinaciones,
        roomTypes: roomTypes,
        serviceTypes: serviceTypes
      },
      count: combinaciones.length,
      info: {
        totalRoomTypes: roomTypes.length,
        totalServiceTypes: serviceTypes.length,
        totalCombinaciones: combinaciones.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo combinaciones de alojamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener combinaciones de alojamiento',
      details: error.message
    });
  }
};

// GET /api/alojamiento/room-types - Obtener tipos de habitación disponibles
const getRoomTypes = async (req, res) => {
  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            cargos: true // Contar cargos que usan este roomType
          }
        }
      }
    });

    res.json({
      success: true,
      data: roomTypes,
      count: roomTypes.length
    });
  } catch (error) {
    console.error('Error obteniendo room types:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos de habitación',
      details: error.message
    });
  }
};

// GET /api/alojamiento/service-types - Obtener tipos de servicio disponibles
const getServiceTypes = async (req, res) => {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            cargos: true // Contar cargos que usan este serviceType
          }
        }
      }
    });

    res.json({
      success: true,
      data: serviceTypes,
      count: serviceTypes.length
    });
  } catch (error) {
    console.error('Error obteniendo service types:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos de servicio',
      details: error.message
    });
  }
};

module.exports = {
  getCombinacionesAlojamiento,
  getRoomTypes,
  getServiceTypes
};
