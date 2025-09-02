const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las habitaciones virtuales
const getVirtualRooms = async (req, res) => {
  try {
    const virtualRooms = await prisma.virtualRoom.findMany({
      include: {
        components: {
          include: {
            room: true
          }
        },
        roomType: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    res.json(virtualRooms);
  } catch (error) {
    console.error('Error fetching virtual rooms:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una habitación virtual por ID
const getVirtualRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const virtualRoom = await prisma.virtualRoom.findUnique({
      where: { id: parseInt(id) },
      include: {
        components: {
          include: {
            room: true
          }
        },
        roomType: true
      }
    });

    if (!virtualRoom) {
      return res.status(404).json({ error: 'Habitación virtual no encontrada' });
    }

    res.json(virtualRoom);
  } catch (error) {
    console.error('Error fetching virtual room:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una nueva habitación virtual
const createVirtualRoom = async (req, res) => {
  try {
    const { name, description, roomTypeId, componentRoomIds } = req.body;

    // Validaciones
    if (!name || !roomTypeId || !componentRoomIds || componentRoomIds.length === 0) {
      return res.status(400).json({ 
        error: 'Nombre, tipo de habitación y al menos una habitación componente son requeridos' 
      });
    }

    // Verificar que el tipo de habitación existe
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId }
    });

    if (!roomType) {
      return res.status(400).json({ error: 'Tipo de habitación no encontrado' });
    }

    // Verificar que todas las habitaciones componentes existen
    const rooms = await prisma.room.findMany({
      where: { id: { in: componentRoomIds } }
    });

    if (rooms.length !== componentRoomIds.length) {
      return res.status(400).json({ error: 'Una o más habitaciones componentes no existen' });
    }

    // Calcular la capacidad total sumando las capacidades de las habitaciones componentes
    const totalCapacity = rooms.reduce((sum, room) => sum + room.maxPeople, 0);

    // Crear la habitación virtual con transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear la habitación virtual
      const virtualRoom = await tx.virtualRoom.create({
        data: {
          name,
          description,
          roomTypeId,
          maxPeople: totalCapacity, // Usar la suma de las capacidades de los componentes
          orderIndex: 0
        }
      });

      // Crear los componentes
      const components = await Promise.all(
        componentRoomIds.map((roomId, index) =>
          tx.virtualRoomComponent.create({
            data: {
              virtualRoomId: virtualRoom.id,
              roomId,
              isRequired: true,
              orderIndex: index
            }
          })
        )
      );

      // Crear inventario para las próximas fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 365); // 1 año de inventario

      const inventoryEntries = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        for (const roomId of componentRoomIds) {
          inventoryEntries.push({
            roomId,
            virtualRoomId: virtualRoom.id,
            date: new Date(currentDate),
            isAvailable: true,
            isBlocked: false
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await tx.roomInventory.createMany({
        data: inventoryEntries,
        skipDuplicates: true
      });

      // Retornar la habitación virtual con sus componentes
      return await tx.virtualRoom.findUnique({
        where: { id: virtualRoom.id },
        include: {
          components: {
            include: {
              room: true
            }
          },
          roomType: true
        }
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating virtual room:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar una habitación virtual
const updateVirtualRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, roomTypeId, componentRoomIds } = req.body;

    // Validaciones
    if (!name || !roomTypeId || !componentRoomIds || componentRoomIds.length === 0) {
      return res.status(400).json({ 
        error: 'Nombre, tipo de habitación y al menos una habitación componente son requeridos' 
      });
    }

    // Verificar que la habitación virtual existe
    const existingVirtualRoom = await prisma.virtualRoom.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingVirtualRoom) {
      return res.status(404).json({ error: 'Habitación virtual no encontrada' });
    }

    // Verificar que el tipo de habitación existe
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId }
    });

    if (!roomType) {
      return res.status(400).json({ error: 'Tipo de habitación no encontrado' });
    }

    // Verificar que todas las habitaciones componentes existen
    const rooms = await prisma.room.findMany({
      where: { id: { in: componentRoomIds } }
    });

    if (rooms.length !== componentRoomIds.length) {
      return res.status(400).json({ error: 'Una o más habitaciones componentes no existen' });
    }

    // Calcular la capacidad total sumando las capacidades de las habitaciones componentes
    const totalCapacity = rooms.reduce((sum, room) => sum + room.maxPeople, 0);

    // Actualizar con transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar la habitación virtual
      const virtualRoom = await tx.virtualRoom.update({
        where: { id: parseInt(id) },
        data: {
          name,
          description,
          roomTypeId,
          maxPeople: totalCapacity // Usar la suma de las capacidades de los componentes
        }
      });

      // Eliminar componentes existentes
      await tx.virtualRoomComponent.deleteMany({
        where: { virtualRoomId: parseInt(id) }
      });

      // Crear nuevos componentes
      await Promise.all(
        componentRoomIds.map((roomId, index) =>
          tx.virtualRoomComponent.create({
            data: {
              virtualRoomId: parseInt(id),
              roomId,
              isRequired: true,
              orderIndex: index
            }
          })
        )
      );

      // Actualizar inventario existente
      await tx.roomInventory.updateMany({
        where: { virtualRoomId: parseInt(id) },
        data: { isAvailable: true, isBlocked: false }
      });

      // Retornar la habitación virtual actualizada
      return await tx.virtualRoom.findUnique({
        where: { id: parseInt(id) },
        include: {
          components: {
            include: {
              room: true
            }
          },
          roomType: true
        }
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating virtual room:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar una habitación virtual
const deleteVirtualRoom = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la habitación virtual existe
    const existingVirtualRoom = await prisma.virtualRoom.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingVirtualRoom) {
      return res.status(404).json({ error: 'Habitación virtual no encontrada' });
    }

    // Eliminar con transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar inventario
      await tx.roomInventory.deleteMany({
        where: { virtualRoomId: parseInt(id) }
      });

      // Eliminar componentes
      await tx.virtualRoomComponent.deleteMany({
        where: { virtualRoomId: parseInt(id) }
      });

      // Eliminar la habitación virtual
      await tx.virtualRoom.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({ message: 'Habitación virtual eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting virtual room:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getVirtualRooms,
  getVirtualRoomById,
  createVirtualRoom,
  updateVirtualRoom,
  deleteVirtualRoom
}; 