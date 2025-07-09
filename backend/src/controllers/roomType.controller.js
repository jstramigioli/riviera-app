const prisma = require('../utils/prisma');

// Listar todos los tipos de habitación
exports.getAllRoomTypes = async (req, res) => {
  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(roomTypes);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching room types' });
  }
};

// Obtener un tipo de habitación específico
exports.getRoomTypeById = async (req, res) => {
  const { id } = req.params;
  try {
    const roomType = await prisma.roomType.findUnique({
      where: { id: Number(id) }
    });
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found' });
    }
    res.json(roomType);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching room type' });
  }
};

// Crear un nuevo tipo de habitación
exports.createRoomType = async (req, res) => {
  const { name, description, multiplier } = req.body;
  try {
    const roomType = await prisma.roomType.create({
      data: {
        name,
        description,
        multiplier: multiplier || 1.0
      }
    });
    res.status(201).json(roomType);
  } catch (error) {
    res.status(500).json({ error: 'Error creating room type' });
  }
};

// Actualizar un tipo de habitación
exports.updateRoomType = async (req, res) => {
  const { id } = req.params;
  const { name, description, multiplier } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Room type id is required' });
  
  try {
    const updatedRoomType = await prisma.roomType.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(multiplier !== undefined && { multiplier })
      }
    });
    res.json(updatedRoomType);
  } catch (error) {
    res.status(404).json({ error: 'Room type not found or invalid data' });
  }
};

// Eliminar un tipo de habitación
exports.deleteRoomType = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.roomType.delete({
      where: { id: Number(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Room type not found' });
  }
}; 