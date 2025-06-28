const prisma = require('../utils/prisma');

// Listar todas las reservas
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        room: {
          include: {
            roomType: true,
            tags: true
          }
        },
        mainClient: true,
        guests: true
      }
    });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching reservations' });
  }
};

// Obtener una reserva específica
exports.getReservationById = async (req, res) => {
  const { id } = req.params;
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: {
        room: {
          include: {
            roomType: true,
            tags: true
          }
        },
        mainClient: true,
        guests: true
      }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching reservation' });
  }
};

// Crear una reserva
exports.createReservation = async (req, res) => {
  const { 
    roomId, 
    mainClientId, 
    guests, 
    checkIn, 
    checkOut, 
    totalAmount, 
    status, 
    notes,
    requiredGuests,
    requiredRoomId,
    requiredTags,
    requirementsNotes
  } = req.body;
  
  if (!roomId || !mainClientId || !checkIn || !checkOut || !requiredGuests) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const newReservation = await prisma.reservation.create({
      data: {
        roomId,
        mainClientId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalAmount: totalAmount || 0,
        status: status || 'active',
        notes,
        requiredGuests: parseInt(requiredGuests),
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null,
        requiredTags: requiredTags && Array.isArray(requiredTags) ? requiredTags : [],
        requirementsNotes,
        guests: {
          create: guests && Array.isArray(guests) ? guests.map(g => ({ 
            firstName: g.firstName, 
            lastName: g.lastName,
            documentType: g.documentType || 'DNI',
            documentNumber: g.documentNumber,
            phone: g.phone,
            email: g.email,
            address: g.address,
            city: g.city
          })) : []
        }
      },
      include: {
        room: {
          include: {
            roomType: true,
            tags: true
          }
        },
        mainClient: true,
        guests: true
      }
    });
    res.status(201).json(newReservation);
  } catch (error) {
    res.status(500).json({ error: 'Error creating reservation', details: error.message });
  }
};

// Actualizar una reserva
exports.updateReservation = async (req, res) => {
  const { id } = req.params;
  const { 
    roomId, 
    mainClientId, 
    checkIn, 
    checkOut, 
    totalAmount, 
    status, 
    reservationType, 
    fixed, 
    notes,
    requiredGuests,
    requiredRoomId,
    requiredTags,
    requirementsNotes
  } = req.body;
  
  if (!roomId || !checkIn || !checkOut || !requiredGuests) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const updateData = {
      roomId: parseInt(roomId),
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      requiredGuests: parseInt(requiredGuests),
      ...(typeof fixed !== 'undefined' ? { fixed } : {}),
      ...(mainClientId && { mainClientId: parseInt(mainClientId) }),
      ...(totalAmount && { totalAmount: parseFloat(totalAmount) }),
      ...(status && { status }),
      ...(reservationType && { reservationType }),
      ...(notes !== undefined && { notes }),
      ...(requiredRoomId !== undefined && { 
        requiredRoomId: requiredRoomId ? parseInt(requiredRoomId) : null 
      }),
      ...(requiredTags !== undefined && { requiredTags }),
      ...(requirementsNotes !== undefined && { requirementsNotes })
    };

    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        room: {
          include: {
            roomType: true,
            tags: true
          }
        },
        mainClient: true,
        guests: true
      }
    });
    res.json(updatedReservation);
  } catch (error) {
    res.status(500).json({ error: 'Error updating reservation', details: error.message });
  }
};

// Eliminar una reserva
exports.deleteReservation = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.reservation.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Reservation not found' });
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

  // Asegurar que requiredTags sea siempre un array
  let tagsArray = [];
  if (Array.isArray(requiredTags)) {
    tagsArray = requiredTags;
  } else if (requiredTags) {
    tagsArray = [requiredTags];
  }

  if (!checkIn || !checkOut || !requiredGuests) {
    return res.status(400).json({ error: 'Check-in, check-out dates and required guests are required' });
  }

  try {
    // Obtener habitaciones ocupadas en el período
    const occupiedRooms = await prisma.reservation.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                checkIn: { lt: new Date(checkOut) },
                checkOut: { gt: new Date(checkIn) }
              }
            ]
          },
          ...(excludeReservationId ? [{ id: { not: parseInt(excludeReservationId) } }] : [])
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

    // Filtrar por etiquetas requeridas si se especifican
    let filteredRooms = allAvailableRooms;
    if (tagsArray.length > 0) {
      filteredRooms = allAvailableRooms.filter(room => {
        const roomTagIds = room.tags.map(tag => tag.id.toString());
        // Al menos una etiqueta debe coincidir (más flexible)
        return tagsArray.some(requiredTagId => roomTagIds.includes(requiredTagId));
      });
    }

    // Obtener habitaciones que cumplan la capacidad mínima
    const availableRooms = filteredRooms.filter(room => room.maxPeople >= parseInt(requiredGuests));

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
      }
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
