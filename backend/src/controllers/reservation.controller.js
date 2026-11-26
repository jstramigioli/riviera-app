const prisma = require('../utils/prisma');
const { safeSyncPrestacionesComida } = require('../utils/prestacionesComida');
const ReservationPricingService = require('../services/reservationPricingService');
const reservationPricingService = new ReservationPricingService(prisma);
const {
  getReservationWithData,
  getAllReservationsWithData,
  createReservationWithSegments,
  updateReservationWithSegments,
  checkRoomAvailability
} = require('../utils/reservationHelpers');
const { selectSegmentIdsToReactivate } = require('../utils/segmentReactivation');
const {
  validateReservationCreation,
  validateReservationUpdate
} = require('../utils/segmentValidation');
const { getCanonicalRoomTypePrice } = require('../services/canonicalPricingService');
const {
  OCCUPYING_STATUSES,
  NON_OCCUPYING_STATUSES,
  VALID_RESERVATION_STATUSES,
  getReservationStatusOptions,
  isValidReservationStatus,
} = require('../constants/reservationStatus');
const {
  shouldIncludeVirtualRooms,
  formatVirtualRoomForAvailability
} = require('../utils/virtualRoomAvailability');

// Listar todas las reservas
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await getAllReservationsWithData();
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Error fetching reservations' });
  }
};

// Obtener una reserva específica
exports.getReservationById = async (req, res) => {
  const { id } = req.params;
  try {
    const reservation = await getReservationWithData(parseInt(id));
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Error fetching reservation' });
  }
};

// Crear una reserva
exports.createReservation = async (req, res) => {
  const { 
    mainClientId, 
    segments,
    status, 
    notes,
    source,
    requiereCuna,
    requiereEstacionamiento,
    vehicleCount,
    vehicleType,
    trailerCount,
    isMultiRoom = false,
    includeHolderAsGuest = true
  } = req.body;
  
  if (!mainClientId || !segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Debe especificar un responsable de la reserva y al menos un segmento' });
  }
  
  try {
    // Preparar datos de la reserva para validación
    const reservationData = {
      mainClientId,
      segments,
      status: status || 'active',
      notes,
      source,
      requiereCuna,
      requiereEstacionamiento,
      vehicleCount,
      vehicleType,
      trailerCount,
      isMultiRoom,
      includeHolderAsGuest
    };

    // Validar la reserva completa antes de crearla
    const validation = await validateReservationCreation(reservationData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Error de validación en la reserva',
        details: validation.errors
      });
    }

    // Crear la reserva con sus segmentos (cargos/night rates ya salen del motor canónico)
    const newReservation = await createReservationWithSegments(reservationData);
    res.status(201).json(newReservation);
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Error creating reservation', details: error.message });
  }
};

// Crear una reserva con segmentos múltiples
exports.createMultiSegmentReservation = async (req, res) => {
  const { 
    mainClientId, 
    segments,
    status, 
    notes,
    source,
    requiereCuna,
    requiereEstacionamiento,
    vehicleCount,
    vehicleType,
    trailerCount,
    isMultiRoom = false,
    includeHolderAsGuest = true,
    selectedRuleIds,
    deselectedRuleIds,
    promotionRuleIds,
    benefitValueByRuleId,
    createdWithManualRate
  } = req.body;
  
  if (!mainClientId || !segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Debe especificar un responsable de la reserva y al menos un segmento' });
  }
  
  try {
    // Preparar datos de la reserva para validación
    const reservationData = {
      mainClientId,
      segments,
      status: status || 'active',
      notes,
      source,
      requiereCuna,
      requiereEstacionamiento,
      vehicleCount,
      vehicleType,
      trailerCount,
      isMultiRoom,
      includeHolderAsGuest,
      selectedRuleIds,
      deselectedRuleIds,
      promotionRuleIds,
      benefitValueByRuleId,
      createdWithManualRate
    };

    console.log('📦 Datos recibidos para crear reserva:', JSON.stringify(reservationData, null, 2));

    // Validar la reserva completa antes de crearla
    const validation = await validateReservationCreation(reservationData);
    if (!validation.isValid) {
      console.error('❌ Error de validación en la reserva:', validation.errors);
      return res.status(400).json({ 
        error: 'Error de validación en la reserva',
        details: validation.errors
      });
    }

    // Crear la reserva con sus segmentos
    const newReservation = await createReservationWithSegments(reservationData);

    res.status(201).json({
      message: 'Reserva creada exitosamente',
      reservation: newReservation
    });
  } catch (error) {
    console.error('Error creating multi-segment reservation:', error);
    res.status(500).json({ error: 'Error creating reservation', details: error.message });
  }
};

// Obtener tarifas detalladas de una reserva
exports.getReservationPricingDetails = async (req, res) => {
  const { id } = req.params;
  
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: {
        mainClient: true,
        guests: {
          include: { client: true }
        },
        nightRates: {
          orderBy: { date: 'asc' }
        },
        segments: {
          include: {
            room: {
              include: {
                roomType: true,
                tags: true
              }
            }
          }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Path canónico: solo night rates persistidos al confirmar (snapshot).
    // NO regenerar con DynamicPricing live — divergiría del monto cobrado/cotizado.
    let pricingSource = 'stored-night-rates';
    if (!reservation.nightRates || reservation.nightRates.length === 0) {
      pricingSource = 'legacy-segment-average';
      console.log(`Reserva ${id} sin nightRates snapshot; usando promedio de segmentos (legacy)`);
      const synthetic = [];
      for (const segment of reservation.segments || []) {
        const start = new Date(segment.startDate);
        const end = new Date(segment.endDate);
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          synthetic.push({
            id: `legacy-${segment.id}-${d.toISOString().slice(0, 10)}`,
            reservationId: reservation.id,
            date: new Date(d),
            baseRate: segment.baseRate,
            dynamicRate: segment.baseRate,
            finalRate: segment.baseRate,
            serviceType: segment.services?.[0] || 'base',
            serviceRate: segment.baseRate,
            manualOverride: false,
            legacySynthetic: true
          });
        }
      }
      reservation.nightRates = synthetic;
    }

    const totalAmount = reservation.nightRates.reduce((sum, n) => sum + Number(n.finalRate || 0), 0);
    const numberOfNights = reservation.nightRates.length;
    
    res.json({
      reservation,
      pricingSummary: {
        totalAmount,
        numberOfNights,
        averageRatePerNight: numberOfNights > 0 ? totalAmount / numberOfNights : 0,
        currency: 'ARS',
        pricingSource,
        pricingEngine: 'canonical-season-block-snapshot'
      }
    });
  } catch (error) {
    console.error('Error obteniendo detalles de tarifas:', error);
    res.status(500).json({ error: 'Error fetching pricing details', details: error.message });
  }
};

// Actualizar una reserva
exports.updateReservation = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  try {
    // Verificar que la reserva existe
    const existingReservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Validar la actualización antes de proceder
    const validation = await validateReservationUpdate(parseInt(id), updateData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Error de validación en la actualización',
        details: validation.errors
      });
    }

    const updatedReservation = await updateReservationWithSegments(id, updateData);
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Error updating reservation', details: error.message });
  }
};

/** GET /api/reservations/statuses — lista canónica del enum (fuente de verdad para el FE) */
exports.getReservationStatuses = (req, res) => {
  res.json({
    statuses: getReservationStatusOptions(),
    values: VALID_RESERVATION_STATUSES,
  });
};

// Actualizar solo el estado de una reserva
exports.updateReservationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    // Verificar que la reserva existe
    const existingReservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (!isValidReservationStatus(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido',
        message: `El estado '${status}' no es válido`,
        validStatuses: VALID_RESERVATION_STATUSES,
        receivedStatus: status
      });
    }

    const wasNonOccupying = NON_OCCUPYING_STATUSES.includes(existingReservation.status);
    const willBeNonOccupying = NON_OCCUPYING_STATUSES.includes(status);
    const reactivating = !willBeNonOccupying && wasNonOccupying;

    // Reactivar: solo el último grupo de tramos desactivado (no los reemplazados por ediciones
    // anteriores) y solo si las habitaciones siguen libres.
    let reactivateIds = [];
    if (reactivating) {
      const allSegments = await prisma.reservationSegment.findMany({
        where: { reservationId: parseInt(id) },
        select: { id: true, isActive: true, updatedAt: true, roomId: true, startDate: true, endDate: true }
      });
      reactivateIds = selectSegmentIdsToReactivate(allSegments);
      const toCheck = allSegments.filter((s) => reactivateIds.includes(s.id));
      const conflicts = [];
      for (const seg of toCheck) {
        const availability = await checkRoomAvailability(seg.roomId, seg.startDate, seg.endDate, id);
        if (!availability.available) {
          conflicts.push({
            segmentId: seg.id,
            roomId: seg.roomId,
            startDate: seg.startDate,
            endDate: seg.endDate,
            reservationIds: (availability.conflicts || []).map((c) => c.reservationId),
            blockedStatus: availability.blockedStatus
          });
        }
      }
      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'No se puede reactivar la reserva',
          message:
            'La habitación ya no está disponible para esas fechas (otra reserva o bloqueo). ' +
            'Modificá la estadía antes de reactivarla.',
          code: 'ROOM_NOT_AVAILABLE',
          conflicts
        });
      }
    }

    // Actualizar estado y liberar/reocupar segmentos según ocupación
    const updatedReservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: parseInt(id) },
        data: { status },
        include: {
          mainClient: true,
          segments: {
            include: {
              room: true,
              roomType: true
            }
          }
        }
      });

      if (willBeNonOccupying && !wasNonOccupying) {
        await tx.reservationSegment.updateMany({
          where: { reservationId: parseInt(id), isActive: true },
          data: { isActive: false }
        });
      } else if (reactivating && reactivateIds.length > 0) {
        await tx.reservationSegment.updateMany({
          where: { reservationId: parseInt(id), id: { in: reactivateIds } },
          data: { isActive: true }
        });
      }

      return tx.reservation.findUnique({
        where: { id: parseInt(id) },
        include: {
          mainClient: true,
          segments: {
            include: {
              room: true,
              roomType: true
            }
          }
        }
      }) || updated;
    });

    // Cancelar / reactivar cambia las comidas previstas
    await safeSyncPrestacionesComida(id);

    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ error: 'Error updating reservation status', details: error.message });
  }
};

// Eliminar una reserva (cascade Account → cargos). Con cobros imputados → 409 (no se borran).
// Con cargos sin cobros → 409 de confirmación (confirmFinancial=true para borrar igual).
exports.deleteReservation = async (req, res) => {
  const { id } = req.params;
  const reservationId = parseInt(id, 10);
  const confirmFinancialWipe =
    req.query.confirmFinancial === '1' ||
    req.query.confirmFinancial === 'true' ||
    req.body?.confirmFinancialWipe === true ||
    req.body?.confirmFinancial === true;

  try {
    const account = await prisma.account.findUnique({
      where: { reservationId },
      select: { id: true }
    });

    let financial = { cargos: 0, cobros: 0, hasFinancials: false };
    if (account) {
      const [cargos, cobros] = await Promise.all([
        prisma.cargo.count({ where: { accountId: account.id } }),
        prisma.cobro.count({ where: { accountId: account.id } })
      ]);
      financial = { cargos, cobros, hasFinancials: cargos > 0 || cobros > 0 };
    } else {
      const [cargos, cobros] = await Promise.all([
        prisma.cargo.count({ where: { reservaId: reservationId } }),
        prisma.cobro.count({ where: { reservaId: reservationId } })
      ]);
      financial = { cargos, cobros, hasFinancials: cargos > 0 || cobros > 0 };
    }

    // Los cobros no se borran en cascada (CobroImputacion → Account/Reservation es RESTRICT):
    // antes el borrado fallaba a mitad de camino (500) dejando la reserva sin huéspedes ni tarifas.
    const imputaciones = await prisma.cobroImputacion.count({
      where: {
        OR: [
          { reservaId: reservationId },
          ...(account ? [{ accountId: account.id }] : [])
        ]
      }
    });
    if (imputaciones > 0) {
      return res.status(409).json({
        error:
          `La reserva tiene ${imputaciones} cobro(s) imputado(s) y no se puede eliminar. ` +
          'Eliminá o devolvé esos cobros desde el estado financiero, o cancelá la reserva.',
        code: 'RESERVATION_HAS_COBROS',
        financial: { ...financial, imputaciones }
      });
    }

    if (financial.hasFinancials && !confirmFinancialWipe) {
      return res.status(409).json({
        error: 'La reserva tiene cobros o cargos en su cuenta',
        code: 'ACCOUNT_HAS_FINANCIALS',
        warning:
          `Al eliminar se borrará la cuenta y ${financial.cargos} cargo(s).`,
        financial,
        accountId: account?.id || null,
        requiresConfirm: true
      });
    }

    // Todo o nada: si falla el borrado de la reserva no quedan huéspedes/tarifas borrados sueltos.
    await prisma.$transaction(async (tx) => {
      await tx.reservationNightRate.deleteMany({ where: { reservationId } });
      await tx.guest.deleteMany({ where: { reservationId } });
      // Cascade: Reservation → Account → Cargo (sin cobros, verificado arriba)
      await tx.reservation.delete({ where: { id: reservationId } });
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: 'Error deleting reservation', details: error.message });
  }
};

// Buscar habitaciones disponibles según requerimientos
exports.findAvailableRooms = async (req, res) => {
  const { 
    checkIn, 
    checkOut, 
    requiredGuests, 
    requiredRoomId, 
    requiredTags = [],
    excludeReservationId 
  } = req.query;

  console.log('🔍 findAvailableRooms - Parámetros recibidos:', {
    checkIn,
    checkOut,
    requiredGuests,
    requiredRoomId,
    requiredTags,
    excludeReservationId
  });

  // Asegurar que requiredTags sea siempre un array
  let tagsArray = [];
  if (Array.isArray(requiredTags)) {
    tagsArray = requiredTags;
  } else if (requiredTags) {
    tagsArray = [requiredTags];
  }

  if (!checkIn || !checkOut || !requiredGuests) {
    console.log('❌ Parámetros requeridos faltantes');
    return res.status(400).json({ error: 'Check-in, check-out dates and required guests are required' });
  }

  try {
    // Verificar disponibilidad de tarifas para la fecha de check-in
    const checkInDate = new Date(checkIn);
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel',
        startDate: { lte: checkInDate },
        endDate: { gte: checkInDate }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isDraft: true
      },
      orderBy: { isDraft: 'asc' }
    });

    // Determinar el estado de las tarifas
    let tariffStatus = {
      hasTariffs: false,
      hasActiveBlock: false,
      hasDraftBlock: false,
      message: '',
      reason: ''
    };

    if (seasonBlocks.length === 0) {
      tariffStatus = {
        hasTariffs: false,
        hasActiveBlock: false,
        hasDraftBlock: false,
        message: 'No hay tarifas cargadas para la fecha especificada',
        reason: 'no_blocks_for_date'
      };
    } else {
      const activeBlock = seasonBlocks.find(block => !block.isDraft);
      
      if (!activeBlock) {
        const draftBlocks = seasonBlocks.filter(block => block.isDraft);
        tariffStatus = {
          hasTariffs: false,
          hasActiveBlock: false,
          hasDraftBlock: true,
          message: 'No hay tarifas confirmadas para la fecha especificada. Existen bloques en borrador.',
          draftBlocks: draftBlocks.map(block => ({
            id: block.id,
            name: block.name,
            startDate: block.startDate,
            endDate: block.endDate
          })),
          reason: 'only_draft_blocks'
        };
      } else {
        tariffStatus = {
          hasTariffs: true,
          hasActiveBlock: true,
          hasDraftBlock: seasonBlocks.some(block => block.isDraft),
          activeBlock: {
            id: activeBlock.id,
            name: activeBlock.name,
            startDate: activeBlock.startDate,
            endDate: activeBlock.endDate
          },
          message: 'Tarifas disponibles para la fecha especificada'
        };
      }
    }

    // Obtener habitaciones ocupadas (ignorar canceladas / no presentadas)
    const occupiedRooms = await prisma.reservationSegment.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                startDate: { lt: new Date(checkOut) },
                endDate: { gt: new Date(checkIn) }
              }
            ]
          },
          {
            isActive: true
          },
          {
            reservation: {
              status: { in: OCCUPYING_STATUSES },
              ...(excludeReservationId
                ? { id: { not: parseInt(excludeReservationId) } }
                : {})
            }
          }
        ]
      },
      select: { roomId: true }
    });

    const occupiedRoomIds = occupiedRooms.map(r => r.roomId);

    // Habitaciones en mantenimiento / no disponible en el rango
    const {
      findBlockedRoomIds
    } = require('../utils/roomStatusPeriods');
    const blockedRoomIds = await findBlockedRoomIds(checkIn, checkOut);
    const unavailableRoomIds = [
      ...new Set([...occupiedRoomIds, ...blockedRoomIds])
    ];

    // Obtener TODAS las habitaciones disponibles (para combinaciones)
    const allAvailableRooms = await prisma.room.findMany({
      where: {
        id: { notIn: unavailableRoomIds },
        status: 'available',
        ...(requiredRoomId && { id: parseInt(requiredRoomId) })
      },
      include: {
        roomType: true,
        tags: true,
        beds: { orderBy: { orderIndex: 'asc' } }
      }
    });

    console.log('🏨 Habitaciones físicas encontradas:', allAvailableRooms.length);
    console.log('🏨 Habitaciones ocupadas:', occupiedRoomIds.length);
    console.log('🏨 Habitaciones bloqueadas (estado):', blockedRoomIds.length);
    console.log('🏨 IDs de habitaciones ocupadas:', occupiedRoomIds);

    // Habitaciones virtuales: no se listan si hay habitación específica;
    // tags = unión de tags de los componentes (filtros/scoring en frontend).
    let virtualRoomsFormatted = [];
    if (shouldIncludeVirtualRooms(requiredRoomId)) {
      const virtualRooms = await prisma.virtualRoom.findMany({
        where: {
          isActive: true
        },
        include: {
          roomType: true,
          components: {
            include: {
              room: {
                include: {
                  tags: true
                }
              }
            }
          }
        }
      });

      const availableVirtualRooms = virtualRooms.filter(virtualRoom => {
        const componentRoomIds = virtualRoom.components.map(comp => comp.roomId);
        return !componentRoomIds.some(roomId => unavailableRoomIds.includes(roomId));
      });

      virtualRoomsFormatted = availableVirtualRooms.map(formatVirtualRoomForAvailability);
    }

    // Combinar habitaciones físicas y virtuales
    const allRooms = [...allAvailableRooms, ...virtualRoomsFormatted];

    // NO filtrar por etiquetas - el frontend se encargará de mostrar todas las habitaciones
    // y marcar visualmente cuáles cumplen o no con los requerimientos
    console.log('🏷️ Etiquetas requeridas:', tagsArray);
    console.log('🏷️ Total de habitaciones disponibles (sin filtrar por etiquetas):', allRooms.length);

    // Obtener habitaciones que cumplan la capacidad mínima
    const availableRooms = allRooms.filter(room => room.maxPeople >= parseInt(requiredGuests));
    console.log('👥 Habitaciones que cumplen capacidad mínima:', availableRooms.length);
    console.log('👥 Capacidad requerida:', requiredGuests);

    // Categorizar habitaciones por capacidad
    const exactCapacityRooms = availableRooms.filter(room => room.maxPeople === parseInt(requiredGuests));
    const largerCapacityRooms = availableRooms.filter(room => room.maxPeople > parseInt(requiredGuests));

    // Ordenar habitaciones de capacidad exacta por etiquetas
    exactCapacityRooms.sort((a, b) => {
      const aScore = calculateTagScore(a, tagsArray);
      const bScore = calculateTagScore(b, tagsArray);
      return bScore - aScore;
    });

    // Ordenar habitaciones de mayor capacidad por proximidad y etiquetas
    largerCapacityRooms.sort((a, b) => {
      const aScore = calculateLargerCapacityScore(a, parseInt(requiredGuests), tagsArray);
      const bScore = calculateLargerCapacityScore(b, parseInt(requiredGuests), tagsArray);
      return bScore - aScore;
    });

    // Combinar resultados: primero exactas, luego mayores
    const sortedRooms = [...exactCapacityRooms, ...largerCapacityRooms];

    // Calcular precios para cada habitación usando bloques de temporada
    const roomsWithPrices = await Promise.all(sortedRooms.map(async (room) => {
      const price = await calculateRoomPrice(room, checkInDate, tariffStatus.activeBlock);
      return {
        ...room,
        price: price
      };
    }));

    // Buscar combinaciones de habitaciones menores si no hay suficientes opciones
    let alternativeCombinations = [];
    if (sortedRooms.length < 3) {
      alternativeCombinations = await findRoomCombinations(allRooms, parseInt(requiredGuests), occupiedRoomIds);
    }

    console.log('✅ Resultado final:', {
      totalFound: roomsWithPrices.length,
      exactCapacityCount: exactCapacityRooms.length,
      largerCapacityCount: largerCapacityRooms.length,
      alternativeCombinations: alternativeCombinations.length
    });

    res.json({
      availableRooms: roomsWithPrices,
      alternativeCombinations,
      totalFound: roomsWithPrices.length,
      exactCapacityCount: exactCapacityRooms.length,
      largerCapacityCount: largerCapacityRooms.length,
      requirements: {
        requiredGuests: parseInt(requiredGuests),
        roomId: requiredRoomId,
        tags: tagsArray
      },
      tariffStatus: tariffStatus
    });
  } catch (error) {
    console.error('Error in findAvailableRooms:', error);
    res.status(500).json({ error: 'Error finding available rooms', details: error.message });
  }
};

// Función para calcular puntuación de etiquetas
function calculateTagScore(room, requiredTags) {
  if (requiredTags.length === 0) return 0;
  
  const roomTagIds = room.tags.map(tag => tag.id.toString());
  const matchingTags = requiredTags.filter(requiredTagId => 
    roomTagIds.includes(requiredTagId)
  );
  
  return (matchingTags.length / requiredTags.length) * 10; // Máximo 10 puntos
}

// Función para calcular puntuación de habitaciones de mayor capacidad
function calculateLargerCapacityScore(room, requiredGuests, requiredTags) {
  let score = 0;
  
  // Puntuación por proximidad de capacidad (menor diferencia = más puntos)
  const capacityDiff = room.maxPeople - requiredGuests;
  if (capacityDiff === 1) {
    score += 8; // Una persona más
  } else if (capacityDiff === 2) {
    score += 6; // Dos personas más
  } else if (capacityDiff === 3) {
    score += 4; // Tres personas más
  } else {
    score += 2; // Más de tres personas
  }
  
  // Puntuación por etiquetas
  score += calculateTagScore(room, requiredTags);
  
  return score;
}

// Función para encontrar combinaciones de habitaciones menores
async function findRoomCombinations(availableRooms, requiredGuests, occupiedRoomIds) {
  const smallerRooms = availableRooms.filter(room => room.maxPeople < requiredGuests);
  
  if (smallerRooms.length === 0) return [];

  const combinations = [];
  
  // Buscar combinaciones de 2 habitaciones
  for (let i = 0; i < smallerRooms.length; i++) {
    for (let j = i + 1; j < smallerRooms.length; j++) {
      const room1 = smallerRooms[i];
      const room2 = smallerRooms[j];
      const totalCapacity = room1.maxPeople + room2.maxPeople;
      
      if (totalCapacity >= requiredGuests) {
        combinations.push({
          type: 'combination',
          rooms: [room1, room2],
          totalCapacity,
          excessCapacity: totalCapacity - requiredGuests,
          description: `${room1.name} (${room1.maxPeople} pers.) + ${room2.name} (${room2.maxPeople} pers.) = ${totalCapacity} personas`
        });
      }
    }
  }
  
  // Buscar combinaciones de 3 habitaciones si es necesario
  if (combinations.length === 0) {
    for (let i = 0; i < smallerRooms.length; i++) {
      for (let j = i + 1; j < smallerRooms.length; j++) {
        for (let k = j + 1; k < smallerRooms.length; k++) {
          const room1 = smallerRooms[i];
          const room2 = smallerRooms[j];
          const room3 = smallerRooms[k];
          const totalCapacity = room1.maxPeople + room2.maxPeople + room3.maxPeople;
          
          if (totalCapacity >= requiredGuests) {
            combinations.push({
              type: 'combination',
              rooms: [room1, room2, room3],
              totalCapacity,
              excessCapacity: totalCapacity - requiredGuests,
              description: `${room1.name} (${room1.maxPeople} pers.) + ${room2.name} (${room2.maxPeople} pers.) + ${room3.name} (${room3.maxPeople} pers.) = ${totalCapacity} personas`
            });
          }
        }
      }
    }
  }
  
  // Ordenar por menor exceso de capacidad
  combinations.sort((a, b) => a.excessCapacity - b.excessCapacity);
  
  return combinations.slice(0, 3); // Limitar a 3 combinaciones
}

// Precio preliminar de disponibilidad — mismo motor canónico (%, redondeo)
async function calculateRoomPrice(room, checkInDate, activeBlock) {
  try {
    if (!activeBlock) {
      return 0;
    }

    const blockWithRelations = await prisma.seasonBlock.findUnique({
      where: { id: activeBlock.id },
      include: {
        seasonPrices: true,
        blockServiceSelections: true
      }
    });

    const price = await getCanonicalRoomTypePrice({
      hotelId: blockWithRelations?.hotelId || activeBlock.hotelId || 'default-hotel',
      roomTypeId: room.roomType.id,
      serviceTypeId: null,
      block: blockWithRelations
    });

    console.log(`Precio canónico preliminar habitación ${room.name}: $${price}`);
    return price;
  } catch (error) {
    console.error('Error calculando precio de habitación:', error);
    return 0;
  }
}
