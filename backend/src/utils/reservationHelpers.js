const { PrismaClient } = require('@prisma/client');
const { civilFromDb, daysBetweenCivil } = require('./calendarDates');
const prisma = new PrismaClient();

/** Normaliza un segmento con fechas civiles yyyy-MM-dd (sin Instant ambiguo). */
function normalizeSegment(segment) {
  if (!segment) return segment;
  return {
    ...segment,
    startDate: civilFromDb(segment.startDate),
    endDate: civilFromDb(segment.endDate)
  };
}

/**
 * Obtiene los datos calculados de una reserva desde sus segmentos.
 * checkIn / checkOut y fechas de segmento salen como yyyy-MM-dd.
 */
function getReservationData(reservation) {
  if (!reservation.segments || reservation.segments.length === 0) {
    return null;
  }

  const activeSegments = reservation.segments
    .filter(s => s.isActive)
    .map(normalizeSegment);
  
  if (activeSegments.length === 0) {
    return null;
  }

  const checkIn = activeSegments
    .map((s) => s.startDate)
    .sort()[0];
  const checkOut = activeSegments
    .map((s) => s.endDate)
    .sort()
    .at(-1);
  
  // Calcular total (noches half-open)
  const totalAmount = activeSegments.reduce((sum, segment) => {
    const days = Math.max(1, daysBetweenCivil(segment.startDate, segment.endDate));
    return sum + (days * segment.baseRate);
  }, 0);

  // Obtener datos del primer segmento activo (como referencia)
  const firstSegment = activeSegments[0];
  
  // Construir el objeto room completo con roomType
  const roomData = firstSegment.room ? {
    ...firstSegment.room,
    roomType: firstSegment.roomType || firstSegment.room.roomType
  } : null;

  const nightCount = Math.max(1, daysBetweenCivil(checkIn, checkOut));
  
  return {
    id: reservation.id,
    mainClientId: reservation.mainClientId,
    checkIn,
    checkOut,
    totalAmount,
    status: reservation.status,
    notes: reservation.notes,
    isMultiRoom: reservation.isMultiRoom,
    parentReservationId: reservation.parentReservationId,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    
    // Datos del primer segmento (como referencia)
    roomId: firstSegment.roomId,
    reservationType: firstSegment.services[0],
    requiredGuests: firstSegment.guestCount,
    
    // Datos calculados
    days: nightCount,
    averageRate: totalAmount / nightCount,
    
    // Relaciones
    mainClient: reservation.mainClient,
    guests: reservation.guests,
    segments: activeSegments,
    childReservations: reservation.childReservations,
    
    room: roomData
  };
}

/**
 * Obtiene una reserva con todos sus datos calculados
 */
async function getReservationWithData(reservationId) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: parseInt(reservationId) },
    include: {
      mainClient: true,
      guests: true,
      segments: {
        where: { isActive: true },
        include: {
          room: true,
          roomType: true
        },
        orderBy: { startDate: 'asc' }
      },
      childReservations: {
        include: {
          segments: {
            where: { isActive: true },
            include: {
              room: true,
              roomType: true
            },
            orderBy: { startDate: 'asc' }
          }
        }
      }
    }
  });

  if (!reservation) {
    return null;
  }

  return getReservationData(reservation);
}

/**
 * Obtiene todas las reservas con datos calculados
 */
async function getAllReservationsWithData() {
  const reservations = await prisma.reservation.findMany({
    include: {
      mainClient: true,
      guests: true,
      segments: {
        where: { isActive: true },
        include: {
          room: true,
          roomType: true
        },
        orderBy: { startDate: 'asc' }
      },
      childReservations: {
        include: {
          segments: {
            where: { isActive: true },
            include: {
              room: true,
              roomType: true
            },
            orderBy: { startDate: 'asc' }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return reservations
    .map(reservation => getReservationData(reservation))
    .filter(data => data !== null);
}

/**
 * Crea una nueva reserva con sus segmentos
 */
async function createReservationWithSegments(reservationData) {
  const {
    mainClientId,
    segments,
    status = 'active',
    notes,
    isMultiRoom = false,
    parentReservationId = null
  } = reservationData;

  // Crear la reserva
  const reservation = await prisma.reservation.create({
    data: {
      mainClientId: parseInt(mainClientId),
      status,
      notes,
      isMultiRoom: segments.length > 1 || isMultiRoom,
      parentReservationId: parentReservationId ? parseInt(parentReservationId) : null
    }
  });

  // Crear todos los segmentos
  const createdSegments = [];
  for (const segmentData of segments) {
    console.log('🔍 Procesando segmento:', JSON.stringify(segmentData, null, 2));
    
    // Validar que services sea un array con al menos un elemento
    if (!segmentData.services || !Array.isArray(segmentData.services) || segmentData.services.length === 0) {
      console.error('❌ Services inválido:', segmentData.services);
      throw new Error('Cada segmento debe tener al menos un servicio especificado (services debe ser un array de IDs)');
    }
    
    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: reservation.id,
        startDate: new Date(segmentData.startDate),
        endDate: new Date(segmentData.endDate),
        roomId: parseInt(segmentData.roomId),
        roomTypeId: segmentData.roomTypeId ? parseInt(segmentData.roomTypeId) : null,
        services: segmentData.services, // Sin fallback - debe venir del frontend
        baseRate: parseFloat(segmentData.baseRate),
        guestCount: parseInt(segmentData.guestCount),
        requiredTags: segmentData.requiredTags || [],
        requiredRoomId: segmentData.requiredRoomId ? parseInt(segmentData.requiredRoomId) : null,
        reason: segmentData.reason || 'Segmento de reserva',
        notes: segmentData.notes || 'Segmento creado automáticamente',
        isActive: true
      },
      include: {
        room: true,
        roomType: true
      }
    });
    createdSegments.push(segment);
  }

  // Crear automáticamente un cargo por cada noche de la reserva
  try {
    for (const segment of createdSegments) {
      const startDate = new Date(segment.startDate);
      const endDate = new Date(segment.endDate);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      // Crear un cargo por cada noche
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // Formatear la fecha para la descripción
        const dateStr = currentDate.toLocaleDateString('es-ES', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });
        
        // Obtener el tipo de servicio del segmento
        const serviceTypeId = segment.services && segment.services.length > 0 ? segment.services[0] : null;
        let serviceTypeLabel = 'Desayuno'; // Valor por defecto
        
        if (serviceTypeId) {
          try {
            // Buscar el tipo de servicio en la base de datos
            const serviceType = await prisma.serviceType.findUnique({
              where: { id: serviceTypeId }
            });
            
            if (serviceType) {
              serviceTypeLabel = serviceType.name;
            } else {
              // Fallback a nombres conocidos si no se encuentra en la BD
              serviceTypeLabel = serviceTypeId === 'con_desayuno' ? 'Desayuno' : 
                                serviceTypeId === 'media_pension' ? 'Media Pensión' : 
                                serviceTypeId === 'pension_completa' ? 'Pensión Completa' : 
                                serviceTypeId;
            }
          } catch (error) {
            console.error('Error obteniendo tipo de servicio:', error);
            // Usar fallback en caso de error
            serviceTypeLabel = serviceTypeId === 'con_desayuno' ? 'Desayuno' : 
                              serviceTypeId === 'media_pension' ? 'Media Pensión' : 
                              serviceTypeId === 'pension_completa' ? 'Pensión Completa' : 
                              serviceTypeId;
          }
        }
        
        await prisma.cargo.create({
          data: {
            reservaId: reservation.id,
            descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
            monto: segment.baseRate,
            tipo: 'ALOJAMIENTO',
            notas: `Noche ${i + 1} de ${days} - Habitación ${segment.room?.name || 'N/A'}`,
            fecha: currentDate
          }
        });
      }
    }

    const totalNights = createdSegments.reduce((totalDays, segment) => {
      const days = Math.ceil((new Date(segment.endDate) - new Date(segment.startDate)) / (1000 * 60 * 60 * 24));
      return totalDays + days;
    }, 0);

    console.log(`✅ ${totalNights} cargos de alojamiento creados automáticamente para reserva #${reservation.id}`);
  } catch (cargoError) {
    console.error('❌ Error creando cargos de reserva:', cargoError);
    // No fallar la creación de la reserva si falla el cargo
  }

  // Retornar la reserva completa
  return getReservationWithData(reservation.id);
}

/**
 * Crea una nueva reserva con su segmento inicial (mantener para compatibilidad)
 */
async function createReservationWithSegment(reservationData) {
  const {
    mainClientId,
    roomId,
    checkIn,
    checkOut,
    totalAmount,
    status = 'active',
    reservationType = 'con_desayuno',
    notes,
    requiredGuests = 1,
    isMultiRoom = false,
    parentReservationId = null
  } = reservationData;

  // Calcular días y tarifa base
  const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  const baseRate = totalAmount / days;

  // Crear la reserva
  const reservation = await prisma.reservation.create({
    data: {
      mainClientId: parseInt(mainClientId),
      status,
      notes,
      isMultiRoom,
      parentReservationId: parentReservationId ? parseInt(parentReservationId) : null
    }
  });

  // Crear el segmento inicial
  const segment = await prisma.reservationSegment.create({
    data: {
      reservationId: reservation.id,
      startDate: new Date(checkIn),
      endDate: new Date(checkOut),
      roomId: parseInt(roomId),
      services: [reservationType],
      baseRate,
      guestCount: parseInt(requiredGuests),
      reason: 'Reserva inicial',
      notes: 'Segmento inicial de la reserva'
    },
    include: {
      room: true,
      roomType: true
    }
  });

  // Crear automáticamente un cargo por cada noche de la reserva
  try {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    // Crear un cargo por cada noche
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Formatear la fecha para la descripción
      const dateStr = currentDate.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      
      // Obtener el tipo de servicio
      const serviceTypeLabel = reservationType === 'con_desayuno' ? 'Desayuno' : 
                              reservationType === 'media_pension' ? 'Media Pensión' : 
                              reservationType === 'pension_completa' ? 'Pensión Completa' : 
                              reservationType;
      
      await prisma.cargo.create({
        data: {
          reservaId: reservation.id,
          descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
          monto: baseRate,
          tipo: 'ALOJAMIENTO',
          notas: `Noche ${i + 1} de ${days}`,
          fecha: currentDate
        }
      });
    }

    console.log(`✅ ${days} cargos de alojamiento creados automáticamente para reserva #${reservation.id}`);
  } catch (cargoError) {
    console.error('❌ Error creando cargos de reserva:', cargoError);
    // No fallar la creación de la reserva si falla el cargo
  }

  // Retornar la reserva completa
  return getReservationWithData(reservation.id);
}

/**
 * Actualiza una reserva y sus segmentos
 */
async function updateReservationWithSegments(reservationId, updateData) {
  const {
    status,
    notes,
    segments
  } = updateData;

  // Actualizar datos básicos de la reserva
  const updatedReservation = await prisma.reservation.update({
    where: { id: parseInt(reservationId) },
    data: {
      status: status || undefined,
      notes: notes !== undefined ? notes : undefined
    }
  });

  // Si se proporcionan nuevos segmentos, actualizarlos
  if (segments && Array.isArray(segments)) {
    // Desactivar segmentos existentes
    await prisma.reservationSegment.updateMany({
      where: { 
        reservationId: parseInt(reservationId),
        isActive: true
      },
      data: { isActive: false }
    });

    // Crear nuevos segmentos
    for (const segmentData of segments) {
      await prisma.reservationSegment.create({
        data: {
          reservationId: parseInt(reservationId),
          startDate: new Date(segmentData.startDate),
          endDate: new Date(segmentData.endDate),
          roomId: parseInt(segmentData.roomId),
          roomTypeId: segmentData.roomTypeId ? parseInt(segmentData.roomTypeId) : null,
          services: segmentData.services || ['con_desayuno'],
          baseRate: parseFloat(segmentData.baseRate),
          guestCount: parseInt(segmentData.guestCount),
          reason: segmentData.reason,
          notes: segmentData.notes
        }
      });
    }
  }

  // Retornar la reserva actualizada
  return getReservationWithData(reservationId);
}

/**
 * Verifica disponibilidad de una habitación en un rango de fechas
 */
async function checkRoomAvailability(roomId, checkIn, checkOut, excludeReservationId = null) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: parseInt(roomId),
      isActive: true,
      reservation: {
        status: { in: ['active', 'confirmed'] },
        id: excludeReservationId ? { not: parseInt(excludeReservationId) } : undefined
      },
      OR: [
        {
          AND: [
            { startDate: { lte: new Date(checkIn) } },
            { endDate: { gt: new Date(checkIn) } }
          ]
        },
        {
          AND: [
            { startDate: { lt: new Date(checkOut) } },
            { endDate: { gte: new Date(checkOut) } }
          ]
        },
        {
          AND: [
            { startDate: { gte: new Date(checkIn) } },
            { endDate: { lte: new Date(checkOut) } }
          ]
        }
      ]
    },
    include: {
      reservation: {
        include: {
          mainClient: true
        }
      }
    }
  });

  return {
    available: conflictingSegments.length === 0,
    conflicts: conflictingSegments
  };
}

module.exports = {
  getReservationData,
  getReservationWithData,
  getAllReservationsWithData,
  createReservationWithSegment,
  createReservationWithSegments,
  updateReservationWithSegments,
  checkRoomAvailability
}; 