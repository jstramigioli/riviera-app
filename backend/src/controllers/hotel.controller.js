const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener información del hotel
const getHotel = async (req, res) => {
  try {
    const hotel = await prisma.hotel.findFirst({
      where: {
        isActive: true
      }
    });

    if (!hotel) {
      return res.status(404).json({ 
        success: false, 
        message: 'No se encontró información del hotel' 
      });
    }

    res.json({
      success: true,
      data: hotel
    });
  } catch (error) {
    console.error('Error al obtener información del hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Crear o actualizar información del hotel
const updateHotel = async (req, res) => {
  try {
    const { name, description, address, phone, email, website } = req.body;

    // Validaciones básicas
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre del hotel es obligatorio'
      });
    }

    // Buscar si ya existe un hotel activo
    let hotel = await prisma.hotel.findFirst({
      where: {
        isActive: true
      }
    });

    if (hotel) {
      // Actualizar hotel existente
      hotel = await prisma.hotel.update({
        where: { id: hotel.id },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          website: website?.trim() || null,
          updatedAt: new Date()
        }
      });
    } else {
      // Crear nuevo hotel
      hotel = await prisma.hotel.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          website: website?.trim() || null,
          isActive: true
        }
      });
    }

    res.json({
      success: true,
      message: 'Información del hotel actualizada correctamente',
      data: hotel
    });
  } catch (error) {
    console.error('Error al actualizar información del hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar hotel (desactivar)
const deleteHotel = async (req, res) => {
  try {
    const { id } = req.params;

    const hotel = await prisma.hotel.findUnique({
      where: { id }
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel no encontrado'
      });
    }

    // Desactivar el hotel en lugar de eliminarlo
    await prisma.hotel.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Hotel desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

module.exports = {
  getHotel,
  updateHotel,
  deleteHotel
}; 