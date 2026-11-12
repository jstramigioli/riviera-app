const { PrismaClient } = require('@prisma/client');
const { civilFromDb, daysBetweenCivil } = require('./calendarDates');
const prisma = new PrismaClient();
const {
  toDateOnlyString,
  dateOnlyUTC,
  getCanonicalNightlyRates
} = require('../services/canonicalPricingService');
const {
  expandVirtualRoomSegments,
  isVirtualBlockingSegment,
  collapseVirtualGroupsForTimeline
} = require('./virtualRoomSegments');

async function resolveHotelId(serviceTypeId) {
  if (serviceTypeId) {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { hotelId: true }
    });
    if (serviceType?.hotelId) return serviceType.hotelId;
  }
  const hotel = await prisma.hotel.findFirst({ select: { id: true } });
  return hotel?.id || 'default-hotel';
}

/**
 * Regenera cargos de alojamiento + ReservationNightRate desde segmentos activos.
 * Conserva cargos con subcategoriaCargoId (consumos/servicios/otros).
 * Prioridad de monto: nightRates del payload → motor canónico → baseRate del segmento.
 */
async function syncLodgingChargesAndNightRates(reservationId, segments, originalSegments = []) {
  const reservaId = parseInt(reservationId, 10);
  if (!Array.isArray(segments) || segments.length === 0) {
    return { totalNights: 0 };
  }

  // Conservar overrides manuales por fecha civil antes de regenerar
  const existingLodging = await prisma.cargo.findMany({
    where: { reservaId, subcategoriaCargoId: null }
  });
  const overrideByDate = new Map();
  for (const cargo of existingLodging) {
    const key = toDateOnlyString(cargo.fecha);
    if (cargo.manualOverride) {
      overrideByDate.set(key, {
        monto: parseFloat(cargo.monto),
        notas: cargo.notas || null
      });
    }
  }

  await prisma.cargo.deleteMany({
    where: {
      reservaId,
      subcategoriaCargoId: null
    }
  });
  await prisma.reservationNightRate.deleteMany({
    where: { reservationId: reservaId }
  });

  let totalNights = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    // Componentes secundarios de virtual solo bloquean ocupación; no generan cargos
    if (isVirtualBlockingSegment(segment)) {
      continue;
    }
    const originalSegment = originalSegments[segmentIndex] || {};
    const startIso = civilFromDb(segment.startDate);
    const endIso = civilFromDb(segment.endDate);
    const days = Math.max(0, daysBetweenCivil(startIso, endIso));
    const serviceTypeId =
      segment.services && segment.services.length > 0 ? segment.services[0] : null;
    const roomTypeId = segment.roomTypeId || segment.room?.roomTypeId || null;

    let serviceTypeLabel = 'Alojamiento';
    if (serviceTypeId) {
      const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
      serviceTypeLabel = serviceType?.name || serviceTypeId;
    }

    let quotedNightRates = Array.isArray(originalSegment.nightRates)
      ? originalSegment.nightRates
      : [];

    if (quotedNightRates.length === 0 && roomTypeId && serviceTypeId && days > 0) {
      try {
        const hotelId = await resolveHotelId(serviceTypeId);
        const canonical = await getCanonicalNightlyRates({
          hotelId,
          roomTypeId: parseInt(roomTypeId, 10),
          serviceTypeId,
          startDate: startIso,
          endDate: endIso
        });
        quotedNightRates = canonical.rates || [];
      } catch (quoteError) {
        console.warn(
          `⚠️ Cotización canónica falló para reserva #${reservaId}; uso baseRate`,
          quoteError.message
        );
      }
    }

    for (let i = 0; i < days; i++) {
      const currentDate = dateOnlyUTC(startIso);
      currentDate.setUTCDate(currentDate.getUTCDate() + i);
      const dateKey = toDateOnlyString(currentDate);

      const quoted = quotedNightRates.find((nr) => {
        const nrDate = toDateOnlyString(nr.date || nr.dateString);
        return nrDate === dateKey;
      });

      // Tarifa original de la reserva (siempre vs cotización/baseRate, no vs override)
      const originalAmount = quoted
        ? parseFloat(quoted.finalRate ?? quoted.serviceRate ?? quoted.baseRate)
        : parseFloat(segment.baseRate);

      const preserved = overrideByDate.get(dateKey);
      const hasOverride = Boolean(preserved);
      const effectiveAmount = hasOverride ? preserved.monto : originalAmount;

      const dateStr = currentDate.toLocaleDateString('es-AR', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      await prisma.cargo.create({
        data: {
          reservaId,
          roomTypeId: roomTypeId ? parseInt(roomTypeId, 10) : null,
          serviceTypeId: serviceTypeId || null,
          descripcion: `Alojamiento - ${dateStr} (${serviceTypeLabel})`,
          monto: effectiveAmount,
          montoOriginal: originalAmount,
          manualOverride: hasOverride,
          notas:
            preserved?.notas ||
            `Noche ${i + 1} de ${days} - Habitación ${segment.room?.name || 'N/A'}`,
          fecha: currentDate
        }
      });

      await prisma.reservationNightRate.create({
        data: {
          reservationId: reservaId,
          date: currentDate,
          baseRate: parseFloat(quoted?.baseRate ?? segment.baseRate),
          dynamicRate: originalAmount,
          finalRate: effectiveAmount,
          serviceType: serviceTypeId || 'base',
          serviceRate: originalAmount,
          manualOverride: hasOverride
        }
      });

      totalNights += 1;
    }
  }

  console.log(`✅ ${totalNights} cargos + night rates sincronizados para reserva #${reservaId}`);
  return { totalNights };
}

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

  const normalized = reservation.segments.map(normalizeSegment);
  const activeSegments = normalized.filter((s) => s.isActive);

  // Canceladas / no-show desactivan segmentos: seguir mostrando historial con inactivos
  const displaySegments =
    activeSegments.length > 0 ? activeSegments : normalized;

  if (displaySegments.length === 0) {
    return null;
  }

  const checkIn = displaySegments
    .map((s) => s.startDate)
    .sort()[0];
  const checkOut = displaySegments
    .map((s) => s.endDate)
    .sort()
    .at(-1);
  
  // Total: solo segmentos con tarifa (ignorar bloqueos secundarios de virtual)
  const billableSegments = displaySegments.filter((s) => !isVirtualBlockingSegment(s));
  const totalAmount = billableSegments.reduce((sum, segment) => {
    const days = Math.max(1, daysBetweenCivil(segment.startDate, segment.endDate));
    return sum + (days * segment.baseRate);
  }, 0);

  // Preferir segmento primario de virtual (con tarifa) como referencia de UI
  const firstSegment = billableSegments[0] || displaySegments[0];
  const virtualRoom = firstSegment.virtualRoom || null;
  
  // Construir el objeto room completo con roomType (o fachada virtual)
  let roomData = firstSegment.room ? {
    ...firstSegment.room,
    roomType: firstSegment.roomType || firstSegment.room.roomType || virtualRoom?.roomType
  } : null;

  if (virtualRoom) {
    roomData = {
      id: `virtual_${virtualRoom.id}`,
      name: virtualRoom.name,
      description: virtualRoom.description,
      maxPeople: virtualRoom.maxPeople,
      isVirtual: true,
      virtualRoomId: virtualRoom.id,
      roomType: virtualRoom.roomType || firstSegment.roomType || roomData?.roomType,
      components: virtualRoom.components || []
    };
  }

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
    roomId: virtualRoom ? `virtual_${virtualRoom.id}` : firstSegment.roomId,
    virtualRoomId: firstSegment.virtualRoomId || virtualRoom?.id || null,
    reservationType: firstSegment.services?.[0],
    requiredGuests: firstSegment.guestCount,
    
    // Datos calculados
    days: nightCount,
    averageRate: totalAmount / nightCount,
    
    // Relaciones — incluir inactivos si no hay activos (historial canceladas)
    mainClient: reservation.mainClient,
    guests: reservation.guests,
    segments: displaySegments,
    childReservations: reservation.childReservations,
    virtualRoom,
    
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
      // Incluir activos e inactivos: canceladas liberan isActive=false pero deben verse
      segments: {
        include: {
          room: true,
          roomType: true,
          virtualRoom: {
            include: {
              roomType: true,
              components: { include: { room: true }, orderBy: { orderIndex: 'asc' } }
            }
          }
        },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }]
      },
      childReservations: {
        include: {
          segments: {
            include: {
              room: true,
              roomType: true,
              virtualRoom: {
                include: {
                  roomType: true,
                  components: { include: { room: true }, orderBy: { orderIndex: 'asc' } }
                }
              }
            },
            orderBy: [{ startDate: 'asc' }, { id: 'asc' }]
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
        include: {
          room: true,
          roomType: true,
          virtualRoom: {
            include: {
              roomType: true,
              components: { include: { room: true }, orderBy: { orderIndex: 'asc' } }
            }
          }
        },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }]
      },
      childReservations: {
        include: {
          segments: {
            include: {
              room: true,
              roomType: true,
              virtualRoom: {
                include: {
                  roomType: true,
                  components: { include: { room: true }, orderBy: { orderIndex: 'asc' } }
                }
              }
            },
            orderBy: [{ startDate: 'asc' }, { id: 'asc' }]
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

  // Expandir virtual_X → componentes físicos + virtualRoomId
  const resolvedSegments = await expandVirtualRoomSegments(segments || []);

  // Validar segmentos ANTES de crear la reserva (evita huérfanas sin segmentos)
  for (const segmentData of resolvedSegments) {
    if (!segmentData.roomId) {
      throw new Error('Cada segmento debe tener una habitación asignada');
    }
    if (!segmentData.startDate || !segmentData.endDate) {
      throw new Error('Cada segmento debe tener fechas de inicio y fin');
    }
    if (!segmentData.services || !Array.isArray(segmentData.services) || segmentData.services.length === 0) {
      throw new Error('Cada segmento debe tener al menos un servicio especificado (services debe ser un array de IDs)');
    }
  }

  const logicalCount = collapseVirtualGroupsForTimeline(resolvedSegments).length;

  // Crear la reserva
  const reservation = await prisma.reservation.create({
    data: {
      mainClientId: parseInt(mainClientId),
      status,
      notes,
      isMultiRoom: logicalCount > 1 || isMultiRoom,
      parentReservationId: parentReservationId ? parseInt(parentReservationId) : null
    }
  });

  // Crear todos los segmentos; si falla, borrar la reserva huérfana
  const createdSegments = [];
  try {
  for (const segmentData of resolvedSegments) {
    console.log('🔍 Procesando segmento:', JSON.stringify(segmentData, null, 2));
    
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
        virtualRoomId: segmentData.virtualRoomId
          ? parseInt(segmentData.virtualRoomId, 10)
          : null,
        services: segmentData.services, // Sin fallback - debe venir del frontend
        baseRate: parseFloat(segmentData.baseRate) || 0,
        guestCount: parseInt(segmentData.guestCount),
        requiredTags: segmentData.requiredTags || [],
        requiredRoomId: segmentData.requiredRoomId ? parseInt(segmentData.requiredRoomId) : null,
        reason: segmentData.reason || 'Segmento de reserva',
        notes: segmentData.notes || 'Segmento creado automáticamente',
        isActive: true
      },
      include: {
        room: true,
        roomType: true,
        virtualRoom: true
      }
    });
    createdSegments.push(segment);
  }
  } catch (segmentError) {
    await prisma.reservation.delete({ where: { id: reservation.id } }).catch(() => {});
    throw segmentError;
  }

  // Cargos + night rates desde la cotización canónica (detalle por noche, no solo promedio)
  try {
    await syncLodgingChargesAndNightRates(reservation.id, createdSegments, resolvedSegments);
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
 * Actualiza una reserva y sus segmentos.
 * Si cambian segmentos (fechas/servicio/habitación), regenera cargos de alojamiento + night rates
 * salvo que applyRateChanges === false (cambio operativo sin tocar precio).
 */
async function updateReservationWithSegments(reservationId, updateData) {
  const {
    status,
    notes,
    segments,
    mainClientId,
    applyRateChanges = true
  } = updateData;

  const id = parseInt(reservationId, 10);

  // Actualizar datos básicos de la reserva
  await prisma.reservation.update({
    where: { id },
    data: {
      status: status || undefined,
      notes: notes !== undefined ? notes : undefined,
      ...(mainClientId != null ? { mainClientId: parseInt(mainClientId, 10) } : {})
    }
  });

  // Si se proporcionan nuevos segmentos, actualizarlos y sincronizar cargos
  if (segments && Array.isArray(segments)) {
    const resolvedSegments = await expandVirtualRoomSegments(segments);

    const previousActive = await prisma.reservationSegment.findMany({
      where: { reservationId: id, isActive: true },
      select: {
        startDate: true,
        endDate: true,
        roomId: true,
        roomTypeId: true,
        virtualRoomId: true,
        services: true,
        baseRate: true
      }
    });

    // Desactivar segmentos existentes
    await prisma.reservationSegment.updateMany({
      where: {
        reservationId: id,
        isActive: true
      },
      data: { isActive: false }
    });

    // Crear nuevos segmentos
    const createdSegments = [];
    for (const segmentData of resolvedSegments) {
      let resolvedRoomTypeId = segmentData.roomTypeId ? parseInt(segmentData.roomTypeId, 10) : null;
      if (!resolvedRoomTypeId && segmentData.roomId) {
        const room = await prisma.room.findUnique({
          where: { id: parseInt(segmentData.roomId, 10) },
          select: { roomTypeId: true }
        });
        resolvedRoomTypeId = room?.roomTypeId || null;
      }

      const created = await prisma.reservationSegment.create({
        data: {
          reservationId: id,
          startDate: new Date(segmentData.startDate),
          endDate: new Date(segmentData.endDate),
          roomId: parseInt(segmentData.roomId, 10),
          roomTypeId: resolvedRoomTypeId,
          virtualRoomId: segmentData.virtualRoomId
            ? parseInt(segmentData.virtualRoomId, 10)
            : null,
          services: segmentData.services || ['con_desayuno'],
          baseRate: parseFloat(segmentData.baseRate) || 0,
          guestCount: parseInt(segmentData.guestCount, 10),
          requiredTags: segmentData.requiredTags || [],
          requiredRoomId: segmentData.requiredRoomId
            ? parseInt(segmentData.requiredRoomId, 10)
            : null,
          reason: segmentData.reason,
          notes: segmentData.notes,
          isActive: true
        },
        include: {
          room: true,
          roomType: true,
          virtualRoom: true
        }
      });
      createdSegments.push(created);
    }

    const shouldApplyRates = applyRateChanges !== false && applyRateChanges !== 'false';
    const needsSync = shouldApplyRates && await lodgingNeedsSync(id, previousActive, createdSegments);
    if (needsSync) {
      try {
        await syncLodgingChargesAndNightRates(id, createdSegments, resolvedSegments);
      } catch (cargoError) {
        console.error(`❌ Error sincronizando cargos/night rates de reserva #${id}:`, cargoError);
        // No revertir el update de segmentos si falla la sync financiera
      }
    }
  }

  // Retornar la reserva actualizada
  return getReservationWithData(reservationId);
}

/** Compara fechas / habitación / servicio / tarifa base para decidir regenerar cargos. */
function lodgingStayChanged(previousSegments, nextSegments) {
  const normalize = (segs) =>
    (segs || [])
      .filter((s) => !isVirtualBlockingSegment(s))
      .map((s) => ({
        start: civilFromDb(s.startDate),
        end: civilFromDb(s.endDate),
        roomId: Number(s.roomId),
        roomTypeId: s.roomTypeId != null ? Number(s.roomTypeId) : null,
        virtualRoomId: s.virtualRoomId != null ? Number(s.virtualRoomId) : null,
        services: Array.isArray(s.services) ? [...s.services].map(String).sort().join(',') : '',
        baseRate: Number(s.baseRate)
      }))
      .sort((a, b) => `${a.start}|${a.roomId}`.localeCompare(`${b.start}|${b.roomId}`));

  const prev = normalize(previousSegments);
  const next = normalize(nextSegments);
  if (prev.length !== next.length) return true;
  return JSON.stringify(prev) !== JSON.stringify(next);
}

function expectedLodgingNights(segments) {
  return (segments || [])
    .filter((s) => !isVirtualBlockingSegment(s))
    .reduce((sum, s) => {
      const start = civilFromDb(s.startDate);
      const end = civilFromDb(s.endDate);
      if (!start || !end) return sum;
      return sum + Math.max(0, daysBetweenCivil(start, end));
    }, 0);
}

/** Regenera si cambió la estadía o si cargos/night rates ya no coinciden con las noches. */
async function lodgingNeedsSync(reservationId, previousSegments, nextSegments) {
  if (lodgingStayChanged(previousSegments, nextSegments)) return true;

  const expected = expectedLodgingNights(nextSegments);
  const [cargoCount, nightCount] = await Promise.all([
    prisma.cargo.count({
      where: { reservaId: reservationId, subcategoriaCargoId: null }
    }),
    prisma.reservationNightRate.count({
      where: { reservationId }
    })
  ]);

  return cargoCount !== expected || nightCount !== expected;
}

/**
 * Verifica disponibilidad de una habitación en un rango de fechas
 */
async function checkRoomAvailability(roomId, checkIn, checkOut, excludeReservationId = null) {
  const { OCCUPYING_STATUSES } = require('../middlewares/reservationStatusValidation');
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: parseInt(roomId),
      isActive: true,
      reservation: {
        status: { in: OCCUPYING_STATUSES },
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
  syncLodgingChargesAndNightRates,
  checkRoomAvailability,
  expandVirtualRoomSegments
}; 