const prisma = require('../utils/prisma');
const {
  defaultBedsForCapacity,
  sanitizeBedsPayload,
  normalizeBedType
} = require('../utils/bedConfig');

const roomInclude = {
  roomType: true,
  tags: true,
  beds: { orderBy: { orderIndex: 'asc' } }
};

async function replaceRoomBeds(roomId, beds) {
  await prisma.roomBed.deleteMany({ where: { roomId: Number(roomId) } });
  if (!beds || beds.length === 0) return [];
  await prisma.roomBed.createMany({
    data: beds.map((bed, index) => ({
      roomId: Number(roomId),
      bedType: normalizeBedType(bed.bedType),
      isSeparable: Boolean(bed.isSeparable) && normalizeBedType(bed.bedType) === 'double',
      orderIndex: Number.isFinite(bed.orderIndex) ? Number(bed.orderIndex) : index
    }))
  });
  return prisma.roomBed.findMany({
    where: { roomId: Number(roomId) },
    orderBy: { orderIndex: 'asc' }
  });
}

// Listar todas las habitaciones
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: roomInclude,
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
      include: roomInclude
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
  const { name, description, roomTypeId, tagIds, beds } = req.body;

  if (!name || !roomTypeId) {
    return res.status(400).json({ error: 'Name and roomTypeId are required' });
  }

  try {
    const roomType = await prisma.roomType.findUnique({
      where: { id: Number(roomTypeId) }
    });

    if (!roomType) {
      return res.status(400).json({ error: 'Invalid roomTypeId' });
    }

    const maxPeople = roomType.maxPeople || 1;
    let bedsToCreate = defaultBedsForCapacity(maxPeople);

    if (beds !== undefined) {
      const sanitized = sanitizeBedsPayload(beds, maxPeople);
      if (!sanitized.validation.ok) {
        return res.status(400).json({ error: sanitized.validation.message });
      }
      bedsToCreate = sanitized.beds.length > 0 ? sanitized.beds : defaultBedsForCapacity(maxPeople);
    }

    const room = await prisma.room.create({
      data: {
        name,
        description,
        roomTypeId: Number(roomTypeId),
        maxPeople,
        status: 'available',
        orderIndex: 0,
        tags: tagIds && tagIds.length > 0 ? {
          connect: tagIds.map(id => ({ id: Number(id) }))
        } : undefined,
        beds: {
          create: bedsToCreate.map((bed, index) => ({
            bedType: bed.bedType,
            isSeparable: Boolean(bed.isSeparable) && bed.bedType === 'double',
            orderIndex: Number.isFinite(bed.orderIndex) ? bed.orderIndex : index
          }))
        }
      },
      include: roomInclude
    });
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Error creating room' });
  }
};

// Actualizar una habitación
exports.updateRoom = async (req, res) => {
  const { id } = req.params;
  const { name, description, roomTypeId, orderIndex, tagIds, beds } = req.body;

  if (!id) return res.status(400).json({ error: 'Room id is required' });

  try {
    const existing = await prisma.room.findUnique({
      where: { id: Number(id) },
      include: { roomType: true }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    let maxPeople = existing.maxPeople;
    let nextRoomTypeId = existing.roomTypeId;
    if (roomTypeId) {
      const roomType = await prisma.roomType.findUnique({
        where: { id: Number(roomTypeId) }
      });
      if (!roomType) {
        return res.status(400).json({ error: 'Invalid roomTypeId' });
      }
      maxPeople = roomType.maxPeople || 1;
      nextRoomTypeId = Number(roomTypeId);
    }

    if (beds !== undefined) {
      const sanitized = sanitizeBedsPayload(beds, maxPeople);
      if (!sanitized.validation.ok) {
        return res.status(400).json({ error: sanitized.validation.message });
      }
      await replaceRoomBeds(id, sanitized.beds);
    } else if (roomTypeId && Number(roomTypeId) !== existing.roomTypeId) {
      // Al cambiar tipo sin enviar camas, regenerar defaults si exceden o están vacías
      const currentBeds = await prisma.roomBed.findMany({ where: { roomId: Number(id) } });
      const sanitized = sanitizeBedsPayload(currentBeds, maxPeople);
      if (!sanitized.validation.ok || currentBeds.length === 0) {
        await replaceRoomBeds(id, defaultBedsForCapacity(maxPeople));
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(roomTypeId && { roomTypeId: nextRoomTypeId }),
        ...(maxPeople && { maxPeople }),
        ...(orderIndex !== undefined && orderIndex !== null && { orderIndex: Number(orderIndex) }),
        tags: tagIds ? {
          set: tagIds.map(tid => ({ id: Number(tid) }))
        } : undefined
      },
      include: roomInclude
    });
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room:', error);
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
