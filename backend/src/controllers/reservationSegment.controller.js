const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todos los segmentos de una reserva
const getReservationSegments = async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    const segments = await prisma.reservationSegment.findMany({
      where: {
        reservationId: parseInt(reservationId),
        isActive: true
      },
      include: {
        room: true,
        roomType: true
      },
      orderBy: {
        startDate: 'asc'
      }
    });
    
    res.json(segments);
  } catch (error) {
    console.error('Error getting reservation segments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener un segmento específico
const getSegmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const segment = await prisma.reservationSegment.findUnique({
      where: { id: parseInt(id) },
      include: {
        room: true,
        roomType: true,
        reservation: {
          include: {
            mainClient: true,
            room: true
          }
        }
      }
    });
    
    if (!segment) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }
    
    res.json(segment);
  } catch (error) {
    console.error('Error getting segment:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear un nuevo segmento
const createSegment = async (req, res) => {
  try {
    const {
      reservationId,
      startDate,
      endDate,
      roomId,
      roomTypeId,
      services = [],
      serviceAdjustments,
      baseRate,
      rateAdjustments,
      guestCount,
      reason,
      notes
    } = req.body;

    // Validar que la reserva existe
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Validar que las fechas están dentro del rango de la reserva
    const reservationStart = new Date(reservation.checkIn);
    const reservationEnd = new Date(reservation.checkOut);
    const segmentStart = new Date(startDate);
    const segmentEnd = new Date(endDate);

    if (segmentStart < reservationStart || segmentEnd > reservationEnd) {
      return res.status(400).json({ 
        error: 'Las fechas del segmento deben estar dentro del rango de la reserva' 
      });
    }

    // Verificar si hay solapamiento con otros segmentos
    const overlappingSegments = await prisma.reservationSegment.findMany({
      where: {
        reservationId: parseInt(reservationId),
        isActive: true,
        OR: [
          {
            AND: [
              { startDate: { lte: segmentStart } },
              { endDate: { gt: segmentStart } }
            ]
          },
          {
            AND: [
              { startDate: { lt: segmentEnd } },
              { endDate: { gte: segmentEnd } }
            ]
          },
          {
            AND: [
              { startDate: { gte: segmentStart } },
              { endDate: { lte: segmentEnd } }
            ]
          }
        ]
      }
    });

    if (overlappingSegments.length > 0) {
      return res.status(400).json({ 
        error: 'El segmento se solapa con segmentos existentes' 
      });
    }

    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: parseInt(reservationId),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        roomId: roomId ? parseInt(roomId) : null,
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : null,
        services,
        serviceAdjustments: serviceAdjustments ? JSON.parse(JSON.stringify(serviceAdjustments)) : null,
        baseRate: baseRate ? parseFloat(baseRate) : null,
        rateAdjustments: rateAdjustments ? JSON.parse(JSON.stringify(rateAdjustments)) : null,
        guestCount: guestCount ? parseInt(guestCount) : null,
        reason,
        notes
      },
      include: {
        room: true,
        roomType: true
      }
    });

    res.status(201).json(segment);
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar un segmento
const updateSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      roomId,
      roomTypeId,
      services,
      serviceAdjustments,
      baseRate,
      rateAdjustments,
      guestCount,
      reason,
      notes,
      isActive
    } = req.body;

    // Verificar que el segmento existe
    const existingSegment = await prisma.reservationSegment.findUnique({
      where: { id: parseInt(id) },
      include: { reservation: true }
    });

    if (!existingSegment) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }

    // Si se están actualizando las fechas, validar solapamientos
    if (startDate && endDate) {
      const segmentStart = new Date(startDate);
      const segmentEnd = new Date(endDate);
      const reservationStart = new Date(existingSegment.reservation.checkIn);
      const reservationEnd = new Date(existingSegment.reservation.checkOut);

      if (segmentStart < reservationStart || segmentEnd > reservationEnd) {
        return res.status(400).json({ 
          error: 'Las fechas del segmento deben estar dentro del rango de la reserva' 
        });
      }

      // Verificar solapamiento con otros segmentos (excluyendo el actual)
      const overlappingSegments = await prisma.reservationSegment.findMany({
        where: {
          reservationId: existingSegment.reservationId,
          id: { not: parseInt(id) },
          isActive: true,
          OR: [
            {
              AND: [
                { startDate: { lte: segmentStart } },
                { endDate: { gt: segmentStart } }
              ]
            },
            {
              AND: [
                { startDate: { lt: segmentEnd } },
                { endDate: { gte: segmentEnd } }
              ]
            },
            {
              AND: [
                { startDate: { gte: segmentStart } },
                { endDate: { lte: segmentEnd } }
              ]
            }
          ]
        }
      });

      if (overlappingSegments.length > 0) {
        return res.status(400).json({ 
          error: 'El segmento se solapa con segmentos existentes' 
        });
      }
    }

    const updatedSegment = await prisma.reservationSegment.update({
      where: { id: parseInt(id) },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        roomId: roomId ? parseInt(roomId) : undefined,
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : undefined,
        services: services ? services : undefined,
        serviceAdjustments: serviceAdjustments ? JSON.parse(JSON.stringify(serviceAdjustments)) : undefined,
        baseRate: baseRate ? parseFloat(baseRate) : undefined,
        rateAdjustments: rateAdjustments ? JSON.parse(JSON.stringify(rateAdjustments)) : undefined,
        guestCount: guestCount ? parseInt(guestCount) : undefined,
        reason: reason !== undefined ? reason : undefined,
        notes: notes !== undefined ? notes : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        room: true,
        roomType: true
      }
    });

    res.json(updatedSegment);
  } catch (error) {
    console.error('Error updating segment:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar un segmento (marcar como inactivo)
const deleteSegment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const segment = await prisma.reservationSegment.findUnique({
      where: { id: parseInt(id) }
    });

    if (!segment) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }

    // Marcar como inactivo en lugar de eliminar físicamente
    await prisma.reservationSegment.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({ message: 'Segmento eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting segment:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener segmentos por fecha (para el grid)
const getSegmentsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, roomId } = req.query;
    
    const whereClause = {
      isActive: true,
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) }
    };

    if (roomId) {
      whereClause.roomId = parseInt(roomId);
    }

    const segments = await prisma.reservationSegment.findMany({
      where: whereClause,
      include: {
        reservation: {
          include: {
            mainClient: true,
            room: true
          }
        },
        room: true,
        roomType: true
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    res.json(segments);
  } catch (error) {
    console.error('Error getting segments by date range:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Función para dividir automáticamente una reserva en segmentos
const autoSplitReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { splitPoints } = req.body; // Array de fechas donde dividir

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) },
      include: {
        segments: {
          where: { isActive: true },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Si ya tiene segmentos, no permitir división automática
    if (reservation.segments.length > 0) {
      return res.status(400).json({ 
        error: 'La reserva ya tiene segmentos definidos' 
      });
    }

    const segments = [];
    const dates = [new Date(reservation.checkIn), ...splitPoints.map(d => new Date(d)), new Date(reservation.checkOut)];
    
    // Crear segmentos entre las fechas de división
    for (let i = 0; i < dates.length - 1; i++) {
      const segment = await prisma.reservationSegment.create({
        data: {
          reservationId: parseInt(reservationId),
          startDate: dates[i],
          endDate: dates[i + 1],
          roomId: reservation.roomId,
          services: [reservation.reservationType],
          baseRate: reservation.totalAmount / Math.ceil((reservation.checkOut - reservation.checkIn) / (1000 * 60 * 60 * 24)),
          reason: 'División automática',
          notes: `Segmento ${i + 1} de ${dates.length - 1}`
        }
      });
      segments.push(segment);
    }

    res.json(segments);
  } catch (error) {
    console.error('Error auto-splitting reservation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getReservationSegments,
  getSegmentById,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentsByDateRange,
  autoSplitReservation
}; 