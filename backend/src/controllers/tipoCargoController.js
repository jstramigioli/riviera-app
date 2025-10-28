const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/tipo-cargo - Obtener todos los tipos de cargo
const getTiposCargo = async (req, res) => {
  try {
    const tipos = await prisma.tipoCargo.findMany({
      where: {
        esActivo: true
      },
      orderBy: [
        { esHardcoded: 'desc' }, // Hardcoded primero
        { ordenIndex: 'asc' },   // Luego por orden
        { nombre: 'asc' }        // Finalmente por nombre
      ],
      include: {
        _count: {
          select: {
            cargos: true // Contar cuántos cargos usan este tipo
          }
        }
      }
    });

    res.json({
      success: true,
      data: tipos,
      count: tipos.length
    });
  } catch (error) {
    console.error('Error obteniendo tipos de cargo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos de cargo',
      details: error.message
    });
  }
};

// GET /api/tipo-cargo/personalizables - Obtener solo tipos personalizables
const getTiposCargoPersonalizables = async (req, res) => {
  try {
    const tipos = await prisma.tipoCargo.findMany({
      where: {
        esHardcoded: false,
        esActivo: true
      },
      orderBy: [
        { ordenIndex: 'asc' },
        { nombre: 'asc' }
      ],
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: tipos,
      count: tipos.length
    });
  } catch (error) {
    console.error('Error obteniendo tipos personalizables:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos personalizables',
      details: error.message
    });
  }
};

// GET /api/tipo-cargo/:id - Obtener un tipo específico
const getTipoCargo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tipo = await prisma.tipoCargo.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      }
    });

    if (!tipo) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de cargo no encontrado'
      });
    }

    res.json({
      success: true,
      data: tipo
    });
  } catch (error) {
    console.error('Error obteniendo tipo de cargo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipo de cargo',
      details: error.message
    });
  }
};

// POST /api/tipo-cargo - Crear nuevo tipo personalizable
const createTipoCargo = async (req, res) => {
  try {
    const { codigo, nombre, descripcion, color, ordenIndex } = req.body;

    // Validaciones
    if (!codigo || !nombre) {
      return res.status(400).json({
        success: false,
        error: 'Código y nombre son requeridos'
      });
    }

    // Verificar que el código no exista
    const existente = await prisma.tipoCargo.findUnique({
      where: { codigo }
    });

    if (existente) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un tipo con este código'
      });
    }

    // Generar orden automático si no se especifica
    let orden = ordenIndex;
    if (!orden) {
      const ultimoTipo = await prisma.tipoCargo.findFirst({
        where: { esHardcoded: false },
        orderBy: { ordenIndex: 'desc' }
      });
      orden = ultimoTipo ? ultimoTipo.ordenIndex + 1 : 100; // Empezar personalizables en 100
    }

    const nuevoTipo = await prisma.tipoCargo.create({
      data: {
        codigo: codigo.toUpperCase().replace(/\s+/g, '_'), // Normalizar código
        nombre,
        descripcion,
        color: color || '#9e9e9e',
        esHardcoded: false, // Siempre false para creados por API
        esActivo: true,
        ordenIndex: orden
      }
    });

    res.status(201).json({
      success: true,
      data: nuevoTipo,
      message: 'Tipo de cargo creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando tipo de cargo:', error);
    
    // Error de código duplicado
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un tipo con este código'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al crear tipo de cargo',
      details: error.message
    });
  }
};

// PUT /api/tipo-cargo/:id - Actualizar tipo personalizable
const updateTipoCargo = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, color, ordenIndex, esActivo } = req.body;

    // Verificar que existe
    const tipoExistente = await prisma.tipoCargo.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tipoExistente) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de cargo no encontrado'
      });
    }

    // No permitir editar tipos hardcoded (excepto orden y activo)
    if (tipoExistente.esHardcoded) {
      // Solo permitir cambiar orden y estado activo para hardcoded
      const updateData = {};
      if (ordenIndex !== undefined) updateData.ordenIndex = ordenIndex;
      if (esActivo !== undefined) updateData.esActivo = esActivo;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Los tipos hardcoded solo pueden cambiar orden y estado activo'
        });
      }

      const tipoActualizado = await prisma.tipoCargo.update({
        where: { id: parseInt(id) },
        data: updateData
      });

      return res.json({
        success: true,
        data: tipoActualizado,
        message: 'Tipo hardcoded actualizado'
      });
    }

    // Para tipos personalizables, permitir todos los cambios
    const updateData = {};
    if (codigo !== undefined) updateData.codigo = codigo.toUpperCase().replace(/\s+/g, '_');
    if (nombre !== undefined) updateData.nombre = nombre;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (color !== undefined) updateData.color = color;
    if (ordenIndex !== undefined) updateData.ordenIndex = ordenIndex;
    if (esActivo !== undefined) updateData.esActivo = esActivo;

    const tipoActualizado = await prisma.tipoCargo.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      data: tipoActualizado,
      message: 'Tipo de cargo actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando tipo de cargo:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un tipo con este código'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al actualizar tipo de cargo',
      details: error.message
    });
  }
};

// DELETE /api/tipo-cargo/:id - Eliminar tipo personalizable
const deleteTipoCargo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const tipo = await prisma.tipoCargo.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      }
    });

    if (!tipo) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de cargo no encontrado'
      });
    }

    // No permitir eliminar tipos hardcoded
    if (tipo.esHardcoded) {
      return res.status(400).json({
        success: false,
        error: 'No se pueden eliminar tipos hardcoded'
      });
    }

    // Verificar si tiene cargos asociados
    if (tipo._count.cargos > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar: hay ${tipo._count.cargos} cargos usando este tipo`,
        suggestion: 'Considera desactivarlo en lugar de eliminarlo'
      });
    }

    await prisma.tipoCargo.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Tipo de cargo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando tipo de cargo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar tipo de cargo',
      details: error.message
    });
  }
};

// PUT /api/tipo-cargo/:id/toggle - Activar/desactivar tipo
const toggleTipoCargo = async (req, res) => {
  try {
    const { id } = req.params;

    const tipo = await prisma.tipoCargo.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tipo) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de cargo no encontrado'
      });
    }

    const tipoActualizado = await prisma.tipoCargo.update({
      where: { id: parseInt(id) },
      data: {
        esActivo: !tipo.esActivo
      }
    });

    res.json({
      success: true,
      data: tipoActualizado,
      message: `Tipo ${tipoActualizado.esActivo ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    console.error('Error alternando tipo de cargo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado del tipo',
      details: error.message
    });
  }
};

module.exports = {
  getTiposCargo,
  getTiposCargoPersonalizables,
  getTipoCargo,
  createTipoCargo,
  updateTipoCargo,
  deleteTipoCargo,
  toggleTipoCargo
};
