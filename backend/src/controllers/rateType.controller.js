const prisma = require('../utils/prisma');

// Obtener todos los tipos de tarifa de un hotel
exports.getRateTypes = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const rateTypes = await prisma.rateType.findMany({
      where: { hotelId },
      orderBy: { orderIndex: 'asc' }
    });
    res.json({ data: rateTypes, errors: null });
  } catch (error) {
    console.error('Error fetching rate types:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener los tipos de tarifa'] 
    });
  }
};

// Crear un nuevo tipo de tarifa
exports.createRateType = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { name, mode, value, orderIndex } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre es requerido'] 
      });
    }
    
    const rateType = await prisma.rateType.create({
      data: {
        hotelId,
        name,
        mode: mode || 'FIXED',
        value: value || 0,
        orderIndex: orderIndex || 0
      }
    });
    
    res.status(201).json({ data: rateType, errors: null });
  } catch (error) {
    console.error('Error creating rate type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al crear el tipo de tarifa'] 
    });
  }
};

// Actualizar un tipo de tarifa
exports.updateRateType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mode, value, orderIndex, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre es requerido'] 
      });
    }
    
    const rateType = await prisma.rateType.update({
      where: { id },
      data: {
        name,
        mode: mode || 'FIXED',
        value: value || 0,
        orderIndex: orderIndex || 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    res.json({ data: rateType, errors: null });
  } catch (error) {
    console.error('Error updating rate type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el tipo de tarifa'] 
    });
  }
};

// Eliminar un tipo de tarifa
exports.deleteRateType = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.rateType.delete({
      where: { id }
    });
    
    res.json({ 
      data: { message: 'Tipo de tarifa eliminado correctamente' }, 
      errors: null 
    });
  } catch (error) {
    console.error('Error deleting rate type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al eliminar el tipo de tarifa'] 
    });
  }
};

// Reordenar tipos de tarifa
exports.reorderRateTypes = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { rateTypes } = req.body;
    
    if (!Array.isArray(rateTypes)) {
      return res.status(400).json({ 
        data: null, 
        errors: ['rateTypes debe ser un array'] 
      });
    }
    
    const updatePromises = rateTypes.map((item, index) => 
      prisma.rateType.update({
        where: { id: item.id },
        data: { orderIndex: index + 1 }
      })
    );
    
    await Promise.all(updatePromises);
    
    const updatedRateTypes = await prisma.rateType.findMany({
      where: { hotelId },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: updatedRateTypes, errors: null });
  } catch (error) {
    console.error('Error reordering rate types:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al reordenar los tipos de tarifa'] 
    });
  }
}; 