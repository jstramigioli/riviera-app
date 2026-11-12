const prisma = require('../utils/prisma');
const ReservationPricingService = require('../services/reservationPricingService');
const reservationPricingService = new ReservationPricingService(prisma);
const {
  getReservationWithData,
  getAllReservationsWithData,
  createReservationWithSegments,
  updateReservationWithSegments,
  checkRoomAvailability
} = require('../utils/reservationHelpers');
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
    isMultiRoom = false
  } = req.body;
  
  if (!mainClientId || !segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Debe especificar un cliente principal y al menos un segmento' });
  }
  
  try {
    // Preparar datos de la reserva para validación
    const reservationData = {
      mainClientId,
      segments,
      status: status || 'active',
      notes,
      source,
      isMultiRoom
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
    isMultiRoom = false
  } = req.body;
  
  if (!mainClientId || !segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Debe especificar un cliente principal y al menos un segmento' });
  }
  
  try {
    // Preparar datos de la reserva para validación
    const reservationData = {
      mainClientId,
      segments,
      status: status || 'active',
      notes,
      source,
      isMultiRoom
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
        guests: true,
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
      } else if (!willBeNonOccupying && wasNonOccupying) {
        await tx.reservationSegment.updateMany({
          where: { reservationId: parseInt(id), isActive: false },
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

    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ error: 'Error updating reservation status', details: error.message });
  }
};

// Eliminar una reserva
exports.deleteReservation = async (req, res) => {
  const { id } = req.params;
  try {
    // Primero eliminar las tarifas por noche relacionadas
    await prisma.reservationNightRate.deleteMany({
      where: { reservationId: parseInt(id) }
    });

    // Luego eliminar los huéspedes relacionados
    await prisma.guest.deleteMany({
      where: { reservationId: parseInt(id) }
    });

    // Finalmente eliminar la reserva
    await prisma.reservation.delete({
      where: { id: parseInt(id) }
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

    // Obtener TODAS las habitaciones disponibles (para combinaciones)
    const allAvailableRooms = await prisma.room.findMany({
      where: {
        id: { notIn: occupiedRoomIds },
        status: 'available',
        ...(requiredRoomId && { id: parseInt(requiredRoomId) })
      },
      include: {
        roomType: true,
        tags: true
      }
    });

    console.log('🏨 Habitaciones físicas encontradas:', allAvailableRooms.length);
    console.log('🏨 Habitaciones ocupadas:', occupiedRoomIds.length);
    console.log('🏨 IDs de habitaciones ocupadas:', occupiedRoomIds);

    // Obtener habitaciones virtuales disponibles
    const virtualRooms = await prisma.virtualRoom.findMany({
      where: {
        isActive: true
      },
      include: {
        roomType: true,
        components: {
          include: {
            room: true
          }
        }
      }
    });

    // Filtrar habitaciones virtuales que estén disponibles (sus componentes no estén ocupados)
    const availableVirtualRooms = virtualRooms.filter(virtualRoom => {
      const componentRoomIds = virtualRoom.components.map(comp => comp.roomId);
      // Verificar que ninguna de las habitaciones componentes esté ocupada
      return !componentRoomIds.some(roomId => occupiedRoomIds.includes(roomId));
    });

    // Convertir habitaciones virtuales al formato esperado
    const virtualRoomsFormatted = availableVirtualRooms.map(virtualRoom => ({
      id: `virtual_${virtualRoom.id}`, // ID especial para identificar como virtual
      name: virtualRoom.name,
      description: virtualRoom.description,
      maxPeople: virtualRoom.maxPeople,
      status: 'available',
      isVirtual: true, // Flag para identificar como habitación virtual
      roomType: virtualRoom.roomType,
      tags: [], // Las habitaciones virtuales no tienen tags por ahora
      components: virtualRoom.components, // Mantener información de componentes
      virtualRoomId: virtualRoom.id // ID original de la habitación virtual
    }));

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
