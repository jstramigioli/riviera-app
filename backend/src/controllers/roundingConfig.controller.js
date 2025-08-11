const prisma = require('../utils/prisma');

// Obtener configuración de redondeo
exports.getRoundingConfig = async (req, res) => {
  try {
    const { hotelId = 'default-hotel' } = req.query;
    
    let config = await prisma.roundingConfig.findUnique({
      where: { hotelId }
    });
    
    // Si no existe, crear una por defecto
    if (!config) {
      config = await prisma.roundingConfig.create({
        data: {
          hotelId,
          multiple: 1,
          mode: 'nearest'
        }
      });
    }
    
    res.json({ data: config, errors: null });
  } catch (error) {
    console.error('Error fetching rounding config:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al obtener la configuración de redondeo'] 
    });
  }
};

// Actualizar configuración de redondeo
exports.updateRoundingConfig = async (req, res) => {
  try {
    const { hotelId = 'default-hotel' } = req.query;
    const { multiple, mode } = req.body;
    
    // Validaciones
    const validMultiples = [1, 10, 100, 500, 1000];
    const validModes = ['nearest', 'ceil', 'floor'];
    
    if (multiple !== undefined && !validMultiples.includes(multiple)) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Múltiplo debe ser uno de: 1, 10, 100, 500, 1000'] 
      });
    }
    
    if (mode !== undefined && !validModes.includes(mode)) {
      return res.status(400).json({ 
        data: null, 
        errors: ['Modo debe ser uno de: nearest, ceil, floor'] 
      });
    }
    
    const updateData = {};
    if (multiple !== undefined) updateData.multiple = multiple;
    if (mode !== undefined) updateData.mode = mode;
    
    const config = await prisma.roundingConfig.upsert({
      where: { hotelId },
      update: updateData,
      create: {
        hotelId,
        multiple: multiple || 1,
        mode: mode || 'nearest'
      }
    });
    
    res.json({ data: config, errors: null });
  } catch (error) {
    console.error('Error updating rounding config:', error);
    res.status(500).json({ 
      data: null, 
      errors: ['Error al actualizar la configuración de redondeo'] 
    });
  }
}; 