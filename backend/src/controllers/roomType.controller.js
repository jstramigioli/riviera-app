const prisma = require('../utils/prisma');

// Listar todos los tipos de habitación
exports.getAllRoomTypes = async (req, res) => {
  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
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
  const { name, description, maxPeople } = req.body;
  try {
    const roomType = await prisma.roomType.create({
      data: {
        name,
        description,
        maxPeople: maxPeople || 1
      }
    });
    res.status(201).json(roomType);
  } catch (error) {
    console.error('Error creating room type:', error);
    res.status(500).json({ error: `Error creating room type: ${error.message}` });
  }
};

// Actualizar un tipo de habitación
exports.updateRoomType = async (req, res) => {
  const { id } = req.params;
  const { name, description, maxPeople } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Room type id is required' });
  
  try {
    const updatedRoomType = await prisma.roomType.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(maxPeople !== undefined && { maxPeople })
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
    res.json({ message: 'Room type deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting room type' });
  }
};

// Actualizar el orden de los tipos de habitación
exports.updateRoomTypesOrder = async (req, res) => {
  const { roomTypeIds } = req.body; // Array de IDs en el nuevo orden
  
  if (!Array.isArray(roomTypeIds)) {
    return res.status(400).json({ error: 'roomTypeIds must be an array' });
  }
  
  try {
    // Actualizar el orderIndex de cada tipo de habitación
    const updatePromises = roomTypeIds.map((id, index) => 
      prisma.roomType.update({
        where: { id: Number(id) },
        data: { orderIndex: index }
      })
    );
    
    await Promise.all(updatePromises);
    
    // Retornar los tipos de habitación actualizados
    const updatedRoomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json(updatedRoomTypes);
  } catch (error) {
    console.error('Error updating room types order:', error);
    res.status(500).json({ error: 'Error updating room types order' });
  }
}; 

// Obtener tipos de habitación por hotel (en realidad son globales)
exports.getRoomTypesByHotel = async (req, res) => {
  const { hotelId } = req.params;
  try {
    // Como RoomType no tiene hotelId, devolvemos todos los tipos de habitación
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    res.json(roomTypes);
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({ error: 'Error fetching room types' });
  }
};

 