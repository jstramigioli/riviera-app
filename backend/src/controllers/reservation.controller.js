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

    // Crear la reserva con sus segmentos
    const newReservation = await createReservationWithSegments(reservationData);

    // Calcular y almacenar tarifas detalladas por noche
    try {
      const serviceType = reservationType === 'con_desayuno' ? 'breakfast' : 
                         reservationType === 'media_pension' ? 'halfBoard' : 'base';
      
      const pricingResult = await reservationPricingService.calculateAndStoreNightRates(
        newReservation.id,
        roomId,
        checkIn,
        checkOut,
        serviceType
      );

      // Actualizar la reserva con el total calculado
      const updatedReservation = await prisma.reservation.update({
        where: { id: newReservation.id },
        data: { totalAmount: pricingResult.totalAmount },
        include: {
          room: {
            include: {
              roomType: true,
              tags: true
            }
          },
          mainClient: true,
          guests: true,
          nightRates: true
        }
      });

      res.status(201).json({
        ...updatedReservation,
        pricingSummary: {
          totalAmount: pricingResult.totalAmount,
          numberOfNights: pricingResult.numberOfNights,
          averageRatePerNight: pricingResult.totalAmount / pricingResult.numberOfNights
        }
      });
    } catch (pricingError) {
      console.error('Error calculando tarifas detalladas:', pricingError);
      // Si falla el cálculo de tarifas, devolver la reserva sin tarifas detalladas
      res.status(201).json(newReservation);
    }
  } catch (error) {
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

    // Si no hay nightRates, generar las tarifas
    if (!reservation.nightRates || reservation.nightRates.length === 0) {
      console.log(`Generando nightRates para reserva ${id}`);
      const roomId = reservation.segments && reservation.segments.length > 0 
        ? reservation.segments[0].roomId 
        : null;
      
      if (!roomId) {
        return res.status(400).json({ error: 'No room found for reservation' });
      }
      
      await reservationPricingService.calculateAndStoreNightRates(
        parseInt(id),
        roomId,
        reservation.segments[0].startDate,
        reservation.segments[0].endDate,
        reservation.segments[0].services[0] || 'con_desayuno'
      );
      
      // Recargar la reserva con las nightRates generadas
      const updatedReservation = await prisma.reservation.findUnique({
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
      
      reservation.nightRates = updatedReservation.nightRates;
    }

    const pricingSummary = await reservationPricingService.getReservationPricingSummary(parseInt(id));
    
    res.json({
      reservation,
      pricingSummary
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

    // Validar el estado
    const validStatuses = ['PENDIENTE', 'CONFIRMADA', 'INGRESADA', 'FINALIZADA', 'CANCELADA', 'NO_PRESENTADA'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido',
        message: `El estado '${status}' no es válido`,
        validStatuses: validStatuses,
        receivedStatus: status
      });
    }

    // Actualizar solo el estado
    const updatedReservation = await prisma.reservation.update({
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

    // Obtener habitaciones ocupadas en el período usando segmentos de reserva
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
          ...(excludeReservationId ? [{ 
            reservation: { 
              id: { not: parseInt(excludeReservationId) } 
            } 
          }] : [])
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

    // Filtrar por etiquetas requeridas si se especifican
    let filteredRooms = allRooms;
    console.log('🏷️ Etiquetas requeridas:', tagsArray);
    if (tagsArray.length > 0) {
      filteredRooms = allRooms.filter(room => {
        const roomTagIds = room.tags.map(tag => tag.id.toString());
        
        // Si la habitación no tiene etiquetas, incluirla (para dar flexibilidad)
        if (roomTagIds.length === 0) {
          console.log(`🏷️ Habitación ${room.name} sin etiquetas - incluyendo por flexibilidad`);
          return true;
        }
        
        // Al menos una etiqueta debe coincidir
        const hasMatchingTag = tagsArray.some(requiredTagId => roomTagIds.includes(requiredTagId));
        if (hasMatchingTag) {
          console.log(`🏷️ Habitación ${room.name} tiene etiqueta coincidente`);
        }
        return hasMatchingTag;
      });
      console.log('🏷️ Habitaciones después del filtro de etiquetas:', filteredRooms.length);
    }

    // Obtener habitaciones que cumplan la capacidad mínima
    const availableRooms = filteredRooms.filter(room => room.maxPeople >= parseInt(requiredGuests));
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

    // Buscar combinaciones de habitaciones menores si no hay suficientes opciones
    let alternativeCombinations = [];
    if (sortedRooms.length < 3) {
      alternativeCombinations = await findRoomCombinations(filteredRooms, parseInt(requiredGuests), occupiedRoomIds);
    }

    console.log('✅ Resultado final:', {
      totalFound: sortedRooms.length,
      exactCapacityCount: exactCapacityRooms.length,
      largerCapacityCount: largerCapacityRooms.length,
      alternativeCombinations: alternativeCombinations.length
    });

    res.json({
      availableRooms: sortedRooms,
      alternativeCombinations,
      totalFound: sortedRooms.length,
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
