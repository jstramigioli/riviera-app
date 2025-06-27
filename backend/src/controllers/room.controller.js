const prisma = require('../utils/prisma');

// Listar todas las habitaciones
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
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
      where: { id: Number(id) }
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
  const { name, description, capacity, price, orderIndex } = req.body;
  try {
    const room = await prisma.room.create({
      data: {
        name,
        description,
        capacity: capacity ? Number(capacity) : null,
        price: price ? Number(price) : null,
        orderIndex: orderIndex ? Number(orderIndex) : null
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
  const { name, description, capacity, price, orderIndex } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Room id is required' });
  
  try {
    const updatedRoom = await prisma.room.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(capacity && { capacity: Number(capacity) }),
        ...(price && { price: Number(price) }),
        ...(orderIndex && { orderIndex: Number(orderIndex) })
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