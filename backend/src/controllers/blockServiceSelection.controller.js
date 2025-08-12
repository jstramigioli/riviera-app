const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las selecciones de servicios de un bloque
const getBlockServiceSelections = async (req, res) => {
  try {
    const { seasonBlockId } = req.params;

    const selections = await prisma.blockServiceSelection.findMany({
      where: {
        seasonBlockId: seasonBlockId
      },
      include: {
        serviceType: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    res.json(selections);
  } catch (error) {
    console.error('Error al obtener selecciones de servicios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una selección específica
const getBlockServiceSelection = async (req, res) => {
  try {
    const { id } = req.params;

    const selection = await prisma.blockServiceSelection.findUnique({
      where: { id },
      include: {
        serviceType: true,
        seasonBlock: true
      }
    });

    if (!selection) {
      return res.status(404).json({ error: 'Selección no encontrada' });
    }

    res.json(selection);
  } catch (error) {
    console.error('Error al obtener selección de servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una nueva selección de servicio
const createBlockServiceSelection = async (req, res) => {
  try {
    const { seasonBlockId, serviceTypeId, isEnabled, orderIndex, percentageAdjustment } = req.body;

    // Validar que el bloque y el servicio existan
    const [seasonBlock, serviceType] = await Promise.all([
      prisma.seasonBlock.findUnique({ where: { id: seasonBlockId } }),
      prisma.serviceType.findUnique({ where: { id: serviceTypeId } })
    ]);

    if (!seasonBlock) {
      return res.status(404).json({ error: 'Bloque de temporada no encontrado' });
    }

    if (!serviceType) {
      return res.status(404).json({ error: 'Tipo de servicio no encontrado' });
    }

    // Verificar que no exista ya una selección para este servicio en este bloque
    const existingSelection = await prisma.blockServiceSelection.findUnique({
      where: {
        seasonBlockId_serviceTypeId: {
          seasonBlockId,
          serviceTypeId
        }
      }
    });

    if (existingSelection) {
      return res.status(400).json({ error: 'Ya existe una selección para este servicio en este bloque' });
    }

    const selection = await prisma.blockServiceSelection.create({
      data: {
        seasonBlockId,
        serviceTypeId,
        isEnabled: isEnabled ?? true,
        orderIndex: orderIndex ?? 0,
        percentageAdjustment: percentageAdjustment ?? 0
      },
      include: {
        serviceType: true
      }
    });

    res.status(201).json(selection);
  } catch (error) {
    console.error('Error al crear selección de servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar una selección de servicio
const updateBlockServiceSelection = async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled, orderIndex, percentageAdjustment } = req.body;

    console.log('Actualizando selección de servicio:', { id, isEnabled, orderIndex, percentageAdjustment });

    // Validar que la selección existe
    const existingSelection = await prisma.blockServiceSelection.findUnique({
      where: { id }
    });

    if (!existingSelection) {
      return res.status(404).json({ error: 'Selección de servicio no encontrada' });
    }

    // Preparar los datos de actualización
    const updateData = {
      isEnabled: isEnabled !== undefined ? isEnabled : existingSelection.isEnabled,
      orderIndex: orderIndex !== undefined ? orderIndex : existingSelection.orderIndex,
      percentageAdjustment: percentageAdjustment !== undefined ? percentageAdjustment : existingSelection.percentageAdjustment
    };

    console.log('Datos de actualización:', updateData);

    const selection = await prisma.blockServiceSelection.update({
      where: { id },
      data: updateData,
      include: {
        serviceType: true
      }
    });

    console.log('Selección actualizada exitosamente:', selection.id);
    res.json(selection);
  } catch (error) {
    console.error('Error al actualizar selección de servicio:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

// Eliminar una selección de servicio
const deleteBlockServiceSelection = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.blockServiceSelection.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar selección de servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Reordenar selecciones de servicios
const reorderBlockServiceSelections = async (req, res) => {
  try {
    const { seasonBlockId } = req.params;
    const { selections } = req.body; // Array de { id, orderIndex }

    const updates = selections.map(selection => 
      prisma.blockServiceSelection.update({
        where: { id: selection.id },
        data: { orderIndex: selection.orderIndex }
      })
    );

    await prisma.$transaction(updates);

    const updatedSelections = await prisma.blockServiceSelection.findMany({
      where: { seasonBlockId },
      include: { serviceType: true },
      orderBy: { orderIndex: 'asc' }
    });

    res.json(updatedSelections);
  } catch (error) {
    console.error('Error al reordenar selecciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener servicios disponibles para un bloque (servicios globales que no están seleccionados)
const getAvailableServices = async (req, res) => {
  try {
    const { seasonBlockId } = req.params;

    // Obtener el hotel del bloque
    const seasonBlock = await prisma.seasonBlock.findUnique({
      where: { id: seasonBlockId },
      include: { hotel: true }
    });

    if (!seasonBlock) {
      return res.status(404).json({ error: 'Bloque de temporada no encontrado' });
    }

    // Obtener servicios ya seleccionados
    const selectedServices = await prisma.blockServiceSelection.findMany({
      where: { seasonBlockId },
      select: { serviceTypeId: true }
    });

    const selectedServiceIds = selectedServices.map(s => s.serviceTypeId);

    // Obtener servicios globales no seleccionados
    const availableServices = await prisma.serviceType.findMany({
      where: {
        hotelId: seasonBlock.hotelId,
        id: {
          notIn: selectedServiceIds
        },
        isActive: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    res.json(availableServices);
  } catch (error) {
    console.error('Error al obtener servicios disponibles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getBlockServiceSelections,
  getBlockServiceSelection,
  createBlockServiceSelection,
  updateBlockServiceSelection,
  deleteBlockServiceSelection,
  reorderBlockServiceSelections,
  getAvailableServices
}; 