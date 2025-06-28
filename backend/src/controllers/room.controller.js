const prisma = require('../utils/prisma');

// Listar todas las habitaciones
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        roomType: true,
        tags: true
      },
      orderBy: { orderIndex: 'asc' }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching rooms' });
  }
};

// Obtener una habitación específica
exports.getRoomById = async (req, res) => {
  const { id } = req.params;
  try {
    const room = await prisma.room.findUnique({
      where: { id: Number(id) },
      include: {
        roomType: true,
        tags: true
      }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching room' });
  }
};

// Crear una nueva habitación
exports.createRoom = async (req, res) => {
  const { name, description, capacity, price, orderIndex, tagIds } = req.body;
  try {
    const room = await prisma.room.create({
      data: {
        name,
        description,
        capacity: capacity ? Number(capacity) : null,
        price: price ? Number(price) : null,
        orderIndex: orderIndex ? Number(orderIndex) : null,
        tags: tagIds ? {
          connect: tagIds.map(id => ({ id: Number(id) }))
        } : undefined
      },
      include: {
        roomType: true,
        tags: true
      }
    });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Error creating room' });
  }
};

// Actualizar una habitación
exports.updateRoom = async (req, res) => {
  const { id } = req.params;
  const { name, description, roomTypeId, orderIndex, tagIds } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Room id is required' });
  
  try {
    // Si se está cambiando el tipo de habitación, obtener la nueva capacidad
    let maxPeople = undefined;
    if (roomTypeId) {
      const roomType = await prisma.roomType.findUnique({
        where: { id: Number(roomTypeId) }
      });
      
      if (roomType) {
        // Mapeo de tipos de habitación a capacidades
        const capacityMap = {
          'single': 1,
          'doble': 2,
          'triple': 3,
          'cuadruple': 4,
          'quintuple': 5,
          'sextuple': 6,
          'departamento El Romerito': 4,
          'departamento El Tilo': 4,
          'departamento Via 1': 4,
          'departamento La Esquinita': 4
        };
        
        maxPeople = capacityMap[roomType.name] || 1;
      }
    }
    
    const updatedRoom = await prisma.room.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(roomTypeId && { roomTypeId: Number(roomTypeId) }),
        ...(maxPeople && { maxPeople }),
        ...(orderIndex && { orderIndex: Number(orderIndex) }),
        tags: tagIds ? {
          set: tagIds.map(id => ({ id: Number(id) }))
        } : undefined
      },
      include: {
        roomType: true,
        tags: true
      }
    });
    res.json(updatedRoom);
  } catch (error) {
    res.status(404).json({ error: 'Room not found or invalid data' });
  }
};

// Eliminar una habitación
exports.deleteRoom = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.room.delete({
      where: { id: Number(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Room not found' });
  }
}; 