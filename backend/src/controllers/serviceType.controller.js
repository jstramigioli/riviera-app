const prisma = require('../utils/prisma');

// Listar todos los tipos de servicio
exports.getAllServiceTypes = async (req, res) => {
  try {
    const { hotelId = 'default-hotel' } = req.query;
    
    const serviceTypes = await prisma.serviceType.findMany({
      where: { hotelId },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: serviceTypes, errors: null });
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener los tipos de servicio'] 
    });
  }
};

// Obtener un tipo de servicio específico
exports.getServiceTypeById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id }
    });
    
    if (!serviceType) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Tipo de servicio no encontrado'] 
      });
    }
    
    res.json({ data: serviceType, errors: null });
  } catch (error) {
    console.error('Error fetching service type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener el tipo de servicio'] 
    });
  }
};

// Crear un nuevo tipo de servicio
exports.createServiceType = async (req, res) => {
  const { name, description, hotelId = 'default-hotel', orderIndex } = req.body;
  
  try {
    // Validaciones
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre del tipo de servicio es requerido'] 
      });
    }
    
    // Verificar que no existe otro tipo de servicio con el mismo nombre
    const existingServiceType = await prisma.serviceType.findFirst({
      where: { 
        hotelId,
        name: name.trim()
      }
    });
    
    if (existingServiceType) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Ya existe un tipo de servicio con ese nombre'] 
      });
    }
    
    // Obtener el siguiente orderIndex si no se especifica
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const lastServiceType = await prisma.serviceType.findFirst({
        where: { hotelId },
        orderBy: { orderIndex: 'desc' }
      });
      finalOrderIndex = (lastServiceType?.orderIndex || 0) + 1;
    }
    
    const serviceType = await prisma.serviceType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        hotelId,
        orderIndex: finalOrderIndex
      }
    });
    
    res.status(201).json({ data: serviceType, errors: null });
  } catch (error) {
    console.error('Error creating service type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al crear el tipo de servicio'] 
    });
  }
};

// Actualizar un tipo de servicio
exports.updateServiceType = async (req, res) => {
  const { id } = req.params;
  const { name, description, orderIndex, isActive } = req.body;
  
  try {
    // Verificar que existe
    const existingServiceType = await prisma.serviceType.findUnique({
      where: { id }
    });
    
    if (!existingServiceType) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Tipo de servicio no encontrado'] 
      });
    }
    
    // Validaciones
    if (name !== undefined && (!name || name.trim() === '')) {
      return res.status(400).json({ 
        data: null, 
        errors: ['El nombre del tipo de servicio es requerido'] 
      });
    }
    
    // Verificar que no existe otro tipo de servicio con el mismo nombre
    if (name && name.trim() !== existingServiceType.name) {
      const duplicateServiceType = await prisma.serviceType.findFirst({
        where: { 
          hotelId: existingServiceType.hotelId,
          name: name.trim(),
          id: { not: id }
        }
      });
      
      if (duplicateServiceType) {
        return res.status(400).json({ 
          data: null, 
          errors: ['Ya existe un tipo de servicio con ese nombre'] 
        });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const serviceType = await prisma.serviceType.update({
      where: { id },
      data: updateData
    });
    
    res.json({ data: serviceType, errors: null });
  } catch (error) {
    console.error('Error updating service type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el tipo de servicio'] 
    });
  }
};

// Eliminar un tipo de servicio
exports.deleteServiceType = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar que existe
    const existingServiceType = await prisma.serviceType.findUnique({
      where: { id },
      include: {
        seasonPrices: true,
        blockServiceSelections: true
      }
    });
    
    if (!existingServiceType) {
      return res.status(404).json({ 
        data: null, 
        errors: ['Tipo de servicio no encontrado'] 
      });
    }
    
    // Verificar que no esté en uso
    if (existingServiceType.seasonPrices.length > 0 || existingServiceType.blockServiceSelections.length > 0) {
      return res.status(400).json({ 
        data: null, 
        errors: ['No se puede eliminar el tipo de servicio porque está siendo usado en bloques de temporada'] 
      });
    }
    
    await prisma.serviceType.delete({
      where: { id }
    });
    
    res.json({ 
      data: { message: 'Tipo de servicio eliminado correctamente' }, 
      errors: null 
    });
  } catch (error) {
    console.error('Error deleting service type:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al eliminar el tipo de servicio'] 
    });
  }
};

// Actualizar el orden de los tipos de servicio
exports.updateServiceTypesOrder = async (req, res) => {
  const { serviceTypes } = req.body;
  const { hotelId = 'default-hotel' } = req.query;
  
  try {
    if (!Array.isArray(serviceTypes)) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Se requiere un array de tipos de servicio'] 
      });
    }
    
    // Actualizar el orden de cada tipo de servicio
    const updatePromises = serviceTypes.map((item, index) => 
      prisma.serviceType.update({
        where: { 
          id: item.id,
          hotelId 
        },
        data: { orderIndex: index + 1 }
      })
    );
    
    await Promise.all(updatePromises);
    
    // Obtener los tipos de servicio actualizados
    const updatedServiceTypes = await prisma.serviceType.findMany({
      where: { hotelId },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json({ data: updatedServiceTypes, errors: null });
  } catch (error) {
    console.error('Error updating service types order:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar el orden de los tipos de servicio'] 
    });
  }
}; 