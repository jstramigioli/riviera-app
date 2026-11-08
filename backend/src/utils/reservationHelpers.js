const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toDateOnlyString } = require('../services/canonicalPricingService');

/**
 * Obtiene los datos calculados de una reserva desde sus segmentos
 */
function getReservationData(reservation) {
  if (!reservation.segments || reservation.segments.length === 0) {
    return null;
  }

  const activeSegments = reservation.segments.filter(s => s.isActive);
  
  if (activeSegments.length === 0) {
    return null;
  }

  // Calcular fechas
  const checkIn = new Date(Math.min(...activeSegments.map(s => new Date(s.startDate))));
  const checkOut = new Date(Math.max(...activeSegments.map(s => new Date(s.endDate))));
  
  // Calcular total
  const totalAmount = activeSegments.reduce((sum, segment) => {
    const days = Math.ceil((new Date(segment.endDate) - new Date(segment.startDate)) / (1000 * 60 * 60 * 24));
    return sum + (days * segment.baseRate);
  }, 0);

  // Obtener datos del primer segmento activo (como referencia)
  const firstSegment = activeSegments[0];
  
  // Construir el objeto room completo con roomType
  const roomData = firstSegment.room ? {
    ...firstSegment.room,
    roomType: firstSegment.roomType || firstSegment.room.roomType
  } : null;
  
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
    // requiredTags eliminado - ahora es por segmento
    
    // Datos del primer segmento (como referencia)
    roomId: firstSegment.roomId,
    reservationType: firstSegment.services[0], // Sin fallback - debe ser un ID válido de ServiceType
    requiredGuests: firstSegment.guestCount,
    
    // Datos calculados
    days: Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)),
    averageRate: totalAmount / Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)),
    
    // Relaciones
    mainClient: reservation.mainClient,
    guests: reservation.guests,
    segments: activeSegments,
    childReservations: reservation.childReservations,
    
    // Incluir la información de la habitación desde el primer segmento con roomType
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
    
    let resolvedRoomTypeId = segmentData.roomTypeId ? parseInt(segmentData.roomTypeId) : null;
    if (!resolvedRoomTypeId && segmentData.roomId) {
      const room = await prisma.room.findUnique({
        where: { id: parseInt(segmentData.roomId) },
        select: { roomTypeId: true }
      });
      resolvedRoomTypeId = room?.roomTypeId || null;
    }

    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: reservation.id,
        startDate: new Date(segmentData.startDate),
        endDate: new Date(segmentData.endDate),
        roomId: parseInt(segmentData.roomId),
        roomTypeId: resolvedRoomTypeId,
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

  // Cargos + night rates desde la cotización canónica (detalle por noche, no solo promedio)
  try {
    let totalNights = 0;

    for (let segmentIndex = 0; segmentIndex < createdSegments.length; segmentIndex++) {
      const segment = createdSegments[segmentIndex];
      const originalSegment = segments[segmentIndex] || {};
      const startDate = new Date(segment.startDate);
      const endDate = new Date(segment.endDate);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const serviceTypeId = segment.services && segment.services.length > 0 ? segment.services[0] : null;
      const roomTypeId = segment.roomTypeId || segment.room?.roomTypeId || null;

      let serviceTypeLabel = 'Alojamiento';
      if (serviceTypeId) {
        const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
        serviceTypeLabel = serviceType?.name || serviceTypeId;
      }

      const quotedNightRates = Array.isArray(originalSegment.nightRates)
        ? originalSegment.nightRates
        : [];

      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = toDateOnlyString(currentDate);

        const quoted = quotedNightRates.find((nr) => {
          const nrDate = toDateOnlyString(nr.date || nr.dateString);
          return nrDate === dateKey;
        });

        const nightAmount = quoted
          ? parseFloat(quoted.finalRate ?? quoted.serviceRate ?? quoted.baseRate)
          : parseFloat(segment.baseRate);

        const dateStr = currentDate.toLocaleDateString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });

        await prisma.cargo.create({
          data: {
            reservaId: reservation.id,
            roomTypeId: roomTypeId ? parseInt(roomTypeId) : null,
            serviceTypeId: serviceTypeId || null,
            descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
            monto: nightAmount,
            notas: `Noche ${i + 1} de ${days} - Habitación ${segment.room?.name || 'N/A'}`,
            fecha: currentDate
          }
        });

        await prisma.reservationNightRate.create({
          data: {
            reservationId: reservation.id,
            date: currentDate,
            baseRate: parseFloat(quoted?.baseRate ?? segment.baseRate),
            dynamicRate: nightAmount,
            finalRate: nightAmount,
            serviceType: serviceTypeId || 'base',
            serviceRate: nightAmount,
            manualOverride: false
          }
        });

        totalNights += 1;
      }
    }

    console.log(`✅ ${totalNights} cargos + night rates creados para reserva #${reservation.id}`);
  } catch (cargoError) {
    console.error('❌ Error creando cargos/night rates de reserva:', cargoError);
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

  // Cargos de alojamiento (schema actual: roomTypeId + serviceTypeId, sin campo tipo)
  try {
    const startDate = new Date(checkIn);
    const room = await prisma.room.findUnique({
      where: { id: parseInt(roomId) },
      include: { roomType: true }
    });
    const serviceType = await prisma.serviceType.findUnique({ where: { id: reservationType } });
    const serviceTypeLabel = serviceType?.name
      || (reservationType === 'con_desayuno' ? 'Desayuno'
        : reservationType === 'media_pension' ? 'Media Pensión'
        : reservationType === 'pension_completa' ? 'Pensión Completa'
        : reservationType);

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dateStr = currentDate.toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      await prisma.cargo.create({
        data: {
          reservaId: reservation.id,
          roomTypeId: room?.roomTypeId || null,
          serviceTypeId: serviceType?.id || null,
          descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
          monto: baseRate,
          notas: `Noche ${i + 1} de ${days}`,
          fecha: currentDate
        }
      });

      await prisma.reservationNightRate.create({
        data: {
          reservationId: reservation.id,
          date: currentDate,
          baseRate,
          dynamicRate: baseRate,
          finalRate: baseRate,
          serviceType: reservationType,
          serviceRate: baseRate,
          manualOverride: false
        }
      });
    }

    console.log(`✅ ${days} cargos + night rates creados para reserva #${reservation.id}`);
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