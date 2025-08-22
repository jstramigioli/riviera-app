const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Crear una reserva multi-habitación
const createMultiRoomReservation = async (req, res) => {
  try {
    const {
      mainClientId,
      checkIn,
      checkOut,
      rooms, // Array de objetos: [{ roomId, guestCount, baseRate, services }]
      totalAmount,
      notes,
      reservationType = 'con_desayuno',
      status = 'active'
    } = req.body;

    // Validar que el cliente existe
    const client = await prisma.client.findUnique({
      where: { id: parseInt(mainClientId) }
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Validar que las habitaciones están disponibles
    for (const roomData of rooms) {
      const room = await prisma.room.findUnique({
        where: { id: parseInt(roomData.roomId) }
      });

      if (!room) {
        return res.status(404).json({ error: `Habitación ${roomData.roomId} no encontrada` });
      }

      // Verificar disponibilidad
      const conflictingReservations = await prisma.reservation.findMany({
        where: {
          roomId: parseInt(roomData.roomId),
          status: { in: ['active', 'confirmed'] },
          OR: [
            {
              AND: [
                { checkIn: { lte: new Date(checkIn) } },
                { checkOut: { gt: new Date(checkIn) } }
              ]
            },
            {
              AND: [
                { checkIn: { lt: new Date(checkOut) } },
                { checkOut: { gte: new Date(checkOut) } }
              ]
            },
            {
              AND: [
                { checkIn: { gte: new Date(checkIn) } },
                { checkOut: { lte: new Date(checkOut) } }
              ]
            }
          ]
        }
      });

      if (conflictingReservations.length > 0) {
        return res.status(400).json({ 
          error: `Habitación ${room.name} no está disponible en las fechas especificadas` 
        });
      }
    }

    // Crear la reserva principal (primera habitación)
    const mainReservation = await prisma.reservation.create({
      data: {
        roomId: parseInt(rooms[0].roomId),
        mainClientId: parseInt(mainClientId),
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalAmount: parseFloat(totalAmount),
        status,
        reservationType,
        notes,
        requiredGuests: rooms[0].guestCount || 1,
        isMultiRoom: true
      }
    });

    // Crear las reservas secundarias (resto de habitaciones)
    const childReservations = [];
    for (let i = 1; i < rooms.length; i++) {
      const roomData = rooms[i];
      const childReservation = await prisma.reservation.create({
        data: {
          roomId: parseInt(roomData.roomId),
          mainClientId: parseInt(mainClientId),
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          totalAmount: parseFloat(roomData.baseRate || 0),
          status,
          reservationType,
          notes: `Parte de reserva multi-habitación #${mainReservation.id}`,
          requiredGuests: roomData.guestCount || 1,
          isMultiRoom: true,
          parentReservationId: mainReservation.id
        }
      });
      childReservations.push(childReservation);
    }

    // Crear segmentos para cada habitación
    const allSegments = [];
    
    // Segmento para la reserva principal
    const mainSegment = await prisma.reservationSegment.create({
      data: {
        reservationId: mainReservation.id,
        startDate: new Date(checkIn),
        endDate: new Date(checkOut),
        roomId: parseInt(rooms[0].roomId),
        services: rooms[0].services || [reservationType],
        baseRate: parseFloat(rooms[0].baseRate || totalAmount / rooms.length),
        reason: 'Reserva multi-habitación',
        notes: 'Habitación principal'
      }
    });
    allSegments.push(mainSegment);

    // Segmentos para las reservas secundarias
    for (let i = 0; i < childReservations.length; i++) {
      const roomData = rooms[i + 1];
      const segment = await prisma.reservationSegment.create({
        data: {
          reservationId: childReservations[i].id,
          startDate: new Date(checkIn),
          endDate: new Date(checkOut),
          roomId: parseInt(roomData.roomId),
          services: roomData.services || [reservationType],
          baseRate: parseFloat(roomData.baseRate || 0),
          reason: 'Reserva multi-habitación',
          notes: `Habitación adicional ${i + 2}`
        }
      });
      allSegments.push(segment);
    }

    // Obtener la reserva completa con todas las relaciones
    const completeReservation = await prisma.reservation.findUnique({
      where: { id: mainReservation.id },
      include: {
        mainClient: true,
        room: true,
        segments: true,
        childReservations: {
          include: {
            room: true,
            segments: true
          }
        }
      }
    });

    res.status(201).json(completeReservation);
  } catch (error) {
    console.error('Error creating multi-room reservation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener todas las reservas multi-habitación
const getMultiRoomReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        isMultiRoom: true,
        parentReservationId: null // Solo las reservas principales
      },
      include: {
        mainClient: true,
        room: true,
        segments: true,
        childReservations: {
          include: {
            room: true,
            segments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(reservations);
  } catch (error) {
    console.error('Error getting multi-room reservations:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una reserva multi-habitación específica
const getMultiRoomReservationById = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findFirst({
      where: {
        OR: [
          { id: parseInt(id), isMultiRoom: true },
          { parentReservationId: parseInt(id), isMultiRoom: true }
        ]
      },
      include: {
        mainClient: true,
        room: true,
        segments: true,
        childReservations: {
          include: {
            room: true,
            segments: true
          }
        },
        parentReservation: {
          include: {
            mainClient: true,
            room: true,
            segments: true,
            childReservations: {
              include: {
                room: true,
                segments: true
              }
            }
          }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva multi-habitación no encontrada' });
    }

    // Si es una reserva secundaria, devolver la principal
    if (reservation.parentReservation) {
      res.json(reservation.parentReservation);
    } else {
      res.json(reservation);
    }
  } catch (error) {
    console.error('Error getting multi-room reservation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar una reserva multi-habitación
const updateMultiRoomReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      checkIn,
      checkOut,
      totalAmount,
      status,
      notes
    } = req.body;

    // Obtener la reserva principal
    const mainReservation = await prisma.reservation.findFirst({
      where: {
        OR: [
          { id: parseInt(id), isMultiRoom: true },
          { parentReservationId: parseInt(id), isMultiRoom: true }
        ]
      },
      include: {
        childReservations: true
      }
    });

    if (!mainReservation) {
      return res.status(404).json({ error: 'Reserva multi-habitación no encontrada' });
    }

    const reservationId = mainReservation.parentReservationId || mainReservation.id;

    // Actualizar la reserva principal
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
        status: status || undefined,
        notes: notes !== undefined ? notes : undefined
      }
    });

    // Actualizar las reservas secundarias
    const childReservations = await prisma.reservation.findMany({
      where: { parentReservationId: reservationId }
    });

    for (const childReservation of childReservations) {
      await prisma.reservation.update({
        where: { id: childReservation.id },
        data: {
          checkIn: checkIn ? new Date(checkIn) : undefined,
          checkOut: checkOut ? new Date(checkOut) : undefined,
          status: status || undefined,
          notes: notes !== undefined ? `Parte de reserva multi-habitación #${reservationId} - ${notes}` : undefined
        }
      });
    }

    // Obtener la reserva actualizada
    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        mainClient: true,
        room: true,
        segments: true,
        childReservations: {
          include: {
            room: true,
            segments: true
          }
        }
      }
    });

    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating multi-room reservation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar una reserva multi-habitación
const deleteMultiRoomReservation = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener la reserva principal
    const mainReservation = await prisma.reservation.findFirst({
      where: {
        OR: [
          { id: parseInt(id), isMultiRoom: true },
          { parentReservationId: parseInt(id), isMultiRoom: true }
        ]
      },
      include: {
        childReservations: true
      }
    });

    if (!mainReservation) {
      return res.status(404).json({ error: 'Reserva multi-habitación no encontrada' });
    }

    const reservationId = mainReservation.parentReservationId || mainReservation.id;

    // Eliminar las reservas secundarias
    const childReservations = await prisma.reservation.findMany({
      where: { parentReservationId: reservationId }
    });

    for (const childReservation of childReservations) {
      await prisma.reservation.delete({
        where: { id: childReservation.id }
      });
    }

    // Eliminar la reserva principal
    await prisma.reservation.delete({
      where: { id: reservationId }
    });

    res.json({ message: 'Reserva multi-habitación eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting multi-room reservation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createMultiRoomReservation,
  getMultiRoomReservations,
  getMultiRoomReservationById,
  updateMultiRoomReservation,
  deleteMultiRoomReservation
}; 