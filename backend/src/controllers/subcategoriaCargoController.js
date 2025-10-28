const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tipos hardcoded permitidos (solo los que usan subcategorías personalizables)
const TIPOS_HARDCODED = ['SERVICIO', 'CONSUMO', 'OTRO'];

// GET /api/subcategoria-cargo - Obtener todas las subcategorías
const getSubcategorias = async (req, res) => {
  try {
    const { tipo } = req.query; // Filtrar por tipo si se especifica
    
    const whereClause = tipo ? { tipo: tipo.toUpperCase() } : {};
    
    const subcategorias = await prisma.subcategoriaCargo.findMany({
      where: {
        ...whereClause,
        esActivo: true
      },
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      },
      orderBy: [
        { tipo: 'asc' },
        { ordenIndex: 'asc' },
        { nombre: 'asc' }
      ]
    });

    // Agrupar por tipo si no se especificó tipo
    if (!tipo) {
      const agrupadas = subcategorias.reduce((groups, sub) => {
        if (!groups[sub.tipo]) {
          groups[sub.tipo] = [];
        }
        groups[sub.tipo].push(sub);
        return groups;
      }, {});

      return res.json({
        success: true,
        data: agrupadas,
        count: subcategorias.length
      });
    }

    res.json({
      success: true,
      data: subcategorias,
      count: subcategorias.length
    });
  } catch (error) {
    console.error('Error obteniendo subcategorías:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener subcategorías',
      details: error.message
    });
  }
};

// GET /api/subcategoria-cargo/tipos - Obtener tipos hardcoded
const getTiposHardcoded = async (req, res) => {
  try {
    // Solo tipos que usan subcategorías personalizables (sin ALOJAMIENTO)
    const tiposPersonalizables = ['SERVICIO', 'CONSUMO', 'OTRO'];
    
    const tiposConInfo = tiposPersonalizables.map(tipo => {
      const info = {
        'SERVICIO': { 
          nombre: 'Servicios', 
          descripcion: 'Servicios adicionales del hotel',
          color: '#2196f3',
          icon: '🔧',
          esPersonalizable: true
        },
        'CONSUMO': { 
          nombre: 'Consumos', 
          descripcion: 'Consumos de bar, restaurante y minibar',
          color: '#ff9800',
          icon: '🍽️',
          esPersonalizable: true
        },
        'OTRO': { 
          nombre: 'Otros', 
          descripcion: 'Otros cargos no clasificados',
          color: '#9e9e9e',
          icon: '📎',
          esPersonalizable: true
        }
      };

      return {
        codigo: tipo,
        ...info[tipo]
      };
    });

    // Agregar información especial sobre alojamiento
    const alojamientoInfo = {
      codigo: 'ALOJAMIENTO',
      nombre: 'Alojamiento',
      descripcion: 'Cargos por estadía - gestionados automáticamente por tipo de habitación y servicio',
      color: '#4caf50',
      icon: '🏠',
      esPersonalizable: false,
      esDinamico: true // Nueva propiedad para indicar que es dinámico
    };

    res.json({
      success: true,
      data: {
        personalizables: tiposConInfo,
        alojamiento: alojamientoInfo
      }
    });
  } catch (error) {
    console.error('Error obteniendo tipos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos',
      details: error.message
    });
  }
};

// GET /api/subcategoria-cargo/:tipo/personalizables - Solo subcategorías personalizables de un tipo
const getSubcategoriasPersonalizables = async (req, res) => {
  try {
    const { tipo } = req.params;
    
    if (!TIPOS_HARDCODED.includes(tipo.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Debe ser uno de: ${TIPOS_HARDCODED.join(', ')}`
      });
    }

    const subcategorias = await prisma.subcategoriaCargo.findMany({
      where: {
        tipo: tipo.toUpperCase()
        // Ya no hay campo esAutoGenerada en el modelo híbrido
      },
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      },
      orderBy: [
        { ordenIndex: 'asc' },
        { nombre: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: subcategorias,
      count: subcategorias.length
    });
  } catch (error) {
    console.error('Error obteniendo subcategorías personalizables:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener subcategorías personalizables',
      details: error.message
    });
  }
};

// POST /api/subcategoria-cargo/:tipo - Crear nueva subcategoría personalizable
const createSubcategoria = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { codigo, nombre, descripcion, color } = req.body;

    if (!TIPOS_HARDCODED.includes(tipo.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Debe ser uno de: ${TIPOS_HARDCODED.join(', ')}`
      });
    }

    // No permitir crear subcategorías de ALOJAMIENTO (son auto-generadas)
    if (tipo.toUpperCase() === 'ALOJAMIENTO') {
      return res.status(400).json({
        success: false,
        error: 'Las subcategorías de alojamiento son auto-generadas y no se pueden crear manualmente'
      });
    }

    if (!codigo || !nombre) {
      return res.status(400).json({
        success: false,
        error: 'Código y nombre son requeridos'
      });
    }

    // Verificar que el código no exista dentro del tipo
    const existente = await prisma.subcategoriaCargo.findFirst({
      where: {
        tipo: tipo.toUpperCase(),
        codigo: codigo.toUpperCase()
      }
    });

    if (existente) {
      return res.status(400).json({
        success: false,
        error: `Ya existe una subcategoría "${codigo}" en el tipo ${tipo}`
      });
    }

    // Obtener el siguiente orden automático
    const ultimaSubcategoria = await prisma.subcategoriaCargo.findFirst({
      where: {
        tipo: tipo.toUpperCase(),
        esAutoGenerada: false
      },
      orderBy: { ordenIndex: 'desc' }
    });

    const siguienteOrden = ultimaSubcategoria ? ultimaSubcategoria.ordenIndex + 1 : 1;

    // Obtener color por defecto del tipo
    const coloresPorDefecto = {
      'SERVICIO': '#2196f3',
      'CONSUMO': '#ff9800',
      'OTRO': '#9e9e9e'
    };

    const nuevaSubcategoria = await prisma.subcategoriaCargo.create({
      data: {
        tipo: tipo.toUpperCase(),
        codigo: codigo.toUpperCase().replace(/\s+/g, '_'),
        nombre,
        descripcion,
        color: color || coloresPorDefecto[tipo.toUpperCase()] || '#9e9e9e',
        esAutoGenerada: false,
        esActivo: true,
        ordenIndex: siguienteOrden
      }
    });

    res.status(201).json({
      success: true,
      data: nuevaSubcategoria,
      message: 'Subcategoría creada exitosamente'
    });
  } catch (error) {
    console.error('Error creando subcategoría:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una subcategoría con este código en este tipo'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al crear subcategoría',
      details: error.message
    });
  }
};

// PUT /api/subcategoria-cargo/:id - Actualizar subcategoría
const updateSubcategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, color, ordenIndex, esActivo } = req.body;

    const subcategoria = await prisma.subcategoriaCargo.findUnique({
      where: { id: parseInt(id) }
    });

    if (!subcategoria) {
      return res.status(404).json({
        success: false,
        error: 'Subcategoría no encontrada'
      });
    }

    // No permitir editar subcategorías auto-generadas de ALOJAMIENTO
    if (subcategoria.esAutoGenerada) {
      // Solo permitir cambiar estado activo y orden para auto-generadas
      const updateData = {};
      if (esActivo !== undefined) updateData.esActivo = esActivo;
      if (ordenIndex !== undefined) updateData.ordenIndex = ordenIndex;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Las subcategorías auto-generadas solo pueden cambiar estado y orden'
        });
      }

      const actualizada = await prisma.subcategoriaCargo.update({
        where: { id: parseInt(id) },
        data: updateData
      });

      return res.json({
        success: true,
        data: actualizada,
        message: 'Subcategoría actualizada'
      });
    }

    // Para subcategorías personalizables, permitir todos los cambios
    const updateData = {};
    if (codigo !== undefined) updateData.codigo = codigo.toUpperCase().replace(/\s+/g, '_');
    if (nombre !== undefined) updateData.nombre = nombre;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (color !== undefined) updateData.color = color;
    if (ordenIndex !== undefined) updateData.ordenIndex = ordenIndex;
    if (esActivo !== undefined) updateData.esActivo = esActivo;

    const actualizada = await prisma.subcategoriaCargo.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      data: actualizada,
      message: 'Subcategoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando subcategoría:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una subcategoría con este código en este tipo'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al actualizar subcategoría',
      details: error.message
    });
  }
};

// DELETE /api/subcategoria-cargo/:id - Eliminar subcategoría personalizable
const deleteSubcategoria = async (req, res) => {
  try {
    const { id } = req.params;

    const subcategoria = await prisma.subcategoriaCargo.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            cargos: true
          }
        }
      }
    });

    if (!subcategoria) {
      return res.status(404).json({
        success: false,
        error: 'Subcategoría no encontrada'
      });
    }

    // No permitir eliminar subcategorías auto-generadas
    if (subcategoria.esAutoGenerada) {
      return res.status(400).json({
        success: false,
        error: 'No se pueden eliminar subcategorías auto-generadas'
      });
    }

    // Verificar si tiene cargos asociados
    if (subcategoria._count.cargos > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar: hay ${subcategoria._count.cargos} cargos usando esta subcategoría`,
        suggestion: 'Considera desactivarla en lugar de eliminarla'
      });
    }

    await prisma.subcategoriaCargo.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Subcategoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando subcategoría:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar subcategoría',
      details: error.message
    });
  }
};

// PUT /api/subcategoria-cargo/:id/toggle - Activar/desactivar
const toggleSubcategoria = async (req, res) => {
  try {
    const { id } = req.params;

    const subcategoria = await prisma.subcategoriaCargo.findUnique({
      where: { id: parseInt(id) }
    });

    if (!subcategoria) {
      return res.status(404).json({
        success: false,
        error: 'Subcategoría no encontrada'
      });
    }

    const actualizada = await prisma.subcategoriaCargo.update({
      where: { id: parseInt(id) },
      data: {
        esActivo: !subcategoria.esActivo
      }
    });

    res.json({
      success: true,
      data: actualizada,
      message: `Subcategoría ${actualizada.esActivo ? 'activada' : 'desactivada'} exitosamente`
    });
  } catch (error) {
    console.error('Error alternando subcategoría:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado de la subcategoría',
      details: error.message
    });
  }
};

module.exports = {
  getSubcategorias,
  getTiposHardcoded,
  getSubcategoriasPersonalizables,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
  toggleSubcategoria
};
