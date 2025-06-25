const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar todas las habitaciones
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching rooms' });
  }
};

// Editar una habitación
exports.updateRoom = async (req, res) => {
  const { id } = req.params;
  const { name, description, tags, maxPeople, status } = req.body;
  if (!id) return res.status(400).json({ error: 'Room id is required' });
  try {
    const updatedRoom = await prisma.room.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(tags && { tags }),
        ...(maxPeople && { maxPeople }),
        ...(status && { status })
      }
    });
    res.json(updatedRoom);
  } catch (error) {
    res.status(404).json({ error: 'Room not found or invalid data' });
  }
}; 