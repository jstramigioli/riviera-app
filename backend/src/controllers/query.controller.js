const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las consultas
const getAllQueries = async (req, res) => {
  try {
    const queries = await prisma.query.findMany({
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(queries);
  } catch (error) {
    console.error('Error al obtener consultas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una consulta por ID
const getQueryById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = await prisma.query.findUnique({
      where: { id: parseInt(id) },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      }
    });

    if (!query) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    res.json(query);
  } catch (error) {
    console.error('Error al obtener consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una nueva consulta
const createQuery = async (req, res) => {
  try {
    const {
      roomId,
      mainClientId,
      checkIn,
      checkOut,
      totalAmount,
      reservationType = 'con_desayuno',
      serviceType = 'base',
      notes,
      fixed = false,
      requiredGuests,
      requiredRoomId,
      requiredTags = [],
      requirementsNotes,
      guests = []
    } = req.body;

    // Crear la consulta
    const query = await prisma.query.create({
      data: {
        roomId: roomId ? parseInt(roomId) : null,
        mainClientId: mainClientId ? parseInt(mainClientId) : null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        reservationType,
        serviceType,
        notes,
        fixed,
        requiredGuests: requiredGuests ? parseInt(requiredGuests) : null,
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null,
        requiredTags,
        requirementsNotes,
        guests: {
          create: guests.map(guest => ({
            firstName: guest.firstName || null,
            lastName: guest.lastName || null,
            documentType: guest.documentType || 'DNI',
            documentNumber: guest.documentNumber || null,
            phone: guest.phone || null,
            email: guest.email || null,
            address: guest.address || null,
            city: guest.city || null
          }))
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      }
    });

    res.status(201).json(query);
  } catch (error) {
    console.error('Error al crear consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar una consulta
const updateQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      roomId,
      mainClientId,
      checkIn,
      checkOut,
      totalAmount,
      status,
      reservationType,
      serviceType,
      notes,
      fixed,
      requiredGuests,
      requiredRoomId,
      requiredTags,
      requirementsNotes
    } = req.body;

    const query = await prisma.query.update({
      where: { id: parseInt(id) },
      data: {
        roomId: roomId ? parseInt(roomId) : null,
        mainClientId: mainClientId ? parseInt(mainClientId) : null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        reservationType,
        serviceType,
        notes,
        fixed,
        requiredGuests: requiredGuests ? parseInt(requiredGuests) : null,
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null,
        requiredTags,
        requirementsNotes
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      }
    });

    res.json(query);
  } catch (error) {
    console.error('Error al actualizar consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar una consulta
const deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const queryId = parseInt(id);
    
    // Verificar si la consulta existe antes de eliminar
    const existingQuery = await prisma.query.findUnique({
      where: { id: queryId }
    });
    
    if (!existingQuery) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }
    
    await prisma.query.delete({
      where: { id: queryId }
    });

    res.json({ message: 'Consulta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Convertir consulta a reserva
const convertQueryToReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener la consulta con todos sus datos
    const query = await prisma.query.findUnique({
      where: { id: parseInt(id) },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: true,
        mainClient: true,
        nightRates: true
      }
    });

    if (!query) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    // Validar que la consulta tenga los datos mínimos necesarios para una reserva
    if (!query.roomId || !query.mainClientId || !query.checkIn || !query.checkOut || !query.totalAmount) {
      return res.status(400).json({ 
        error: 'La consulta no tiene todos los datos necesarios para convertirse en reserva',
        missingFields: {
          roomId: !query.roomId,
          mainClientId: !query.mainClientId,
          checkIn: !query.checkIn,
          checkOut: !query.checkOut,
          totalAmount: !query.totalAmount
        }
      });
    }

    // Crear la reserva usando los datos de la consulta
    const reservation = await prisma.reservation.create({
      data: {
        roomId: query.roomId,
        mainClientId: query.mainClientId,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        totalAmount: query.totalAmount,
        status: 'confirmada',
        reservationType: query.reservationType || 'con_desayuno',
        notes: query.notes,
        fixed: query.fixed || false,
        requiredGuests: query.requiredGuests || 1,
        requiredRoomId: query.requiredRoomId,
        requiredTags: query.requiredTags || [],
        requirementsNotes: query.requirementsNotes,
        guests: {
          create: query.guests.map(guest => ({
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            documentType: guest.documentType || 'DNI',
            documentNumber: guest.documentNumber,
            phone: guest.phone,
            email: guest.email,
            address: guest.address,
            city: guest.city
          }))
        },
        nightRates: {
          create: query.nightRates.map(rate => ({
            date: rate.date || new Date(),
            baseRate: rate.baseRate || 0,
            dynamicRate: rate.dynamicRate || 0,
            finalRate: rate.finalRate || 0,
            serviceType: rate.serviceType || 'con_desayuno',
            serviceRate: rate.serviceRate || 0,
            occupancyScore: rate.occupancyScore,
            isWeekend: rate.isWeekend || false,
            isHoliday: rate.isHoliday || false,
            gapPromotionApplied: rate.gapPromotionApplied || false,
            gapPromotionRate: rate.gapPromotionRate,
            manualOverride: rate.manualOverride || false,
            basePrice: rate.basePrice || 0,
            occupancyAdjustment: rate.occupancyAdjustment,
            anticipationAdjustment: rate.anticipationAdjustment,
            weekendAdjustment: rate.weekendAdjustment,
            holidayAdjustment: rate.holidayAdjustment,
            gapPromotionAmount: rate.gapPromotionAmount,
            serviceAdjustment: rate.serviceAdjustment
          }))
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      }
    });

    // Eliminar la consulta original
    await prisma.query.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'Consulta convertida a reserva exitosamente',
      reservation
    });
  } catch (error) {
    console.error('Error al convertir consulta a reserva:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Agregar huésped a una consulta
const addGuestToQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const guestData = req.body;

    const guest = await prisma.queryGuest.create({
      data: {
        ...guestData,
        queryId: parseInt(id)
      },
      include: {
        payments: true
      }
    });

    res.status(201).json(guest);
  } catch (error) {
    console.error('Error al agregar huésped a consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar huésped de una consulta
const updateQueryGuest = async (req, res) => {
  try {
    const { id, guestId } = req.params;
    const guestData = req.body;

    const guest = await prisma.queryGuest.update({
      where: { id: parseInt(guestId) },
      data: guestData,
      include: {
        payments: true
      }
    });

    res.json(guest);
  } catch (error) {
    console.error('Error al actualizar huésped de consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar huésped de una consulta
const deleteQueryGuest = async (req, res) => {
  try {
    const { guestId } = req.params;
    await prisma.queryGuest.delete({
      where: { id: parseInt(guestId) }
    });

    res.json({ message: 'Huésped eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar huésped de consulta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener consultas recientes por cliente (últimos 60 días)
const getQueryByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Calcular fecha hace 60 días
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const queries = await prisma.query.findMany({
      where: { 
        mainClientId: parseInt(clientId),
        updatedAt: {
          gte: sixtyDaysAgo
        }
      },
      include: {
        guests: {
          include: {
            payments: true
          }
        },
        room: {
          include: {
            tags: true,
            roomType: true
          }
        },
        mainClient: true,
        nightRates: true
      },
      orderBy: {
        updatedAt: 'desc' // Más recientes primero
      }
    });

    // Retornar array vacío si no hay consultas (no es error)
    res.json(queries);
  } catch (error) {
    console.error('Error al obtener consultas por cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllQueries,
  getQueryById,
  createQuery,
  updateQuery,
  deleteQuery,
  convertQueryToReservation,
  addGuestToQuery,
  updateQueryGuest,
  deleteQueryGuest,
  getQueryByClient
}; 