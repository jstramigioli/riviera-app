const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todos los tipos de servicio de un bloque específico
const getBlockServiceTypes = async (req, res) => {
  try {
    const { seasonBlockId } = req.params;
    
    const blockServiceTypes = await prisma.blockServiceType.findMany({
      where: {
        seasonBlockId: seasonBlockId,
        isActive: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });
    
    res.json(blockServiceTypes);
  } catch (error) {
    console.error('Error getting block service types:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener un tipo de servicio específico del bloque
const getBlockServiceType = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blockServiceType = await prisma.blockServiceType.findUnique({
      where: { id }
    });
    
    if (!blockServiceType) {
      return res.status(404).json({ error: 'Tipo de servicio no encontrado' });
    }
    
    res.json(blockServiceType);
  } catch (error) {
    console.error('Error getting block service type:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear un nuevo tipo de servicio para el bloque
const createBlockServiceType = async (req, res) => {
  try {
    const { seasonBlockId, name, description, adjustmentMode, adjustmentValue } = req.body;
    
    // Validar que el bloque existe
    const seasonBlock = await prisma.seasonBlock.findUnique({
      where: { id: seasonBlockId }
    });
    
    if (!seasonBlock) {
      return res.status(404).json({ error: 'Bloque de temporada no encontrado' });
    }
    
    // Obtener el siguiente orderIndex
    const lastServiceType = await prisma.blockServiceType.findFirst({
      where: { seasonBlockId },
      orderBy: { orderIndex: 'desc' }
    });
    
    const orderIndex = lastServiceType ? lastServiceType.orderIndex + 1 : 0;
    
    const blockServiceType = await prisma.blockServiceType.create({
      data: {
        seasonBlockId,
        name,
        description,
        adjustmentMode: adjustmentMode || 'PERCENTAGE',
        adjustmentValue: adjustmentValue || 0,
        orderIndex
      }
    });
    
    res.status(201).json(blockServiceType);
  } catch (error) {
    console.error('Error creating block service type:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un tipo de servicio con ese nombre en este bloque' });
    }
    
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar un tipo de servicio del bloque
const updateBlockServiceType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, adjustmentMode, adjustmentValue, isActive, orderIndex } = req.body;
    
    const blockServiceType = await prisma.blockServiceType.update({
      where: { id },
      data: {
        name,
        description,
        adjustmentMode,
        adjustmentValue,
        isActive,
        orderIndex
      }
    });
    
    res.json(blockServiceType);
  } catch (error) {
    console.error('Error updating block service type:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tipo de servicio no encontrado' });
    }
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un tipo de servicio con ese nombre en este bloque' });
    }
    
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar un tipo de servicio del bloque
const deleteBlockServiceType = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.blockServiceType.delete({
      where: { id }
    });
    
    res.json({ message: 'Tipo de servicio eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting block service type:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tipo de servicio no encontrado' });
    }
    
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Reordenar los tipos de servicio del bloque
const reorderBlockServiceTypes = async (req, res) => {
  try {
    const { seasonBlockId } = req.params;
    const { serviceTypeIds } = req.body; // Array de IDs en el nuevo orden
    
    const updates = serviceTypeIds.map((id, index) => 
      prisma.blockServiceType.update({
        where: { id },
        data: { orderIndex: index }
      })
    );
    
    await prisma.$transaction(updates);
    
    res.json({ message: 'Orden actualizado exitosamente' });
  } catch (error) {
    console.error('Error reordering block service types:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getBlockServiceTypes,
  getBlockServiceType,
  createBlockServiceType,
  updateBlockServiceType,
  deleteBlockServiceType,
  reorderBlockServiceTypes
}; 