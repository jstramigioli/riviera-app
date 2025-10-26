const prisma = require('../utils/prisma');

// ============================================
// CONTROLADORES DE CONFIGURACIÓN
// ============================================

// Obtener todas las configuraciones
exports.getConfiguraciones = async (req, res) => {
  try {
    const configuraciones = await prisma.configuracion.findMany({
      where: { activo: true },
      orderBy: { clave: 'asc' }
    });
    res.json(configuraciones);
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    res.status(500).json({ error: 'Error al obtener las configuraciones', details: error.message });
  }
};

// Obtener una configuración específica por clave
exports.getConfiguracionByClave = async (req, res) => {
  const { clave } = req.params;
  try {
    const configuracion = await prisma.configuracion.findUnique({
      where: { clave }
    });
    
    if (!configuracion) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    res.json(configuracion);
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ error: 'Error al obtener la configuración', details: error.message });
  }
};

// Crear o actualizar una configuración
exports.upsertConfiguracion = async (req, res) => {
  const { clave, valor, descripcion } = req.body;

  if (!clave || valor === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos: clave y valor' });
  }

  try {
    const configuracion = await prisma.configuracion.upsert({
      where: { clave },
      update: {
        valor,
        descripcion: descripcion || null,
        activo: true
      },
      create: {
        clave,
        valor,
        descripcion: descripcion || null,
        activo: true
      }
    });
    
    res.json(configuracion);
  } catch (error) {
    console.error('Error creando/actualizando configuración:', error);
    res.status(500).json({ error: 'Error al guardar la configuración', details: error.message });
  }
};

// Actualizar una configuración existente
exports.updateConfiguracion = async (req, res) => {
  const { clave } = req.params;
  const { valor, descripcion, activo } = req.body;

  try {
    const dataToUpdate = {};
    if (valor !== undefined) dataToUpdate.valor = valor;
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (activo !== undefined) dataToUpdate.activo = activo;

    const configuracion = await prisma.configuracion.update({
      where: { clave },
      data: dataToUpdate
    });
    
    res.json(configuracion);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración', details: error.message });
  }
};

// Eliminar una configuración (marcar como inactiva)
exports.deleteConfiguracion = async (req, res) => {
  const { clave } = req.params;
  try {
    await prisma.configuracion.update({
      where: { clave },
      data: { activo: false }
    });
    
    res.json({ message: 'Configuración eliminada exitosamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    console.error('Error eliminando configuración:', error);
    res.status(500).json({ error: 'Error al eliminar la configuración', details: error.message });
  }
};

// Obtener el tipo de cambio actual del dólar
exports.getTipoCambioUSD = async (req, res) => {
  try {
    const configuracion = await prisma.configuracion.findUnique({
      where: { clave: 'tipo_cambio_usd' }
    });
    
    if (!configuracion) {
      return res.json({ 
        tipoCambio: null, 
        message: 'No se ha configurado el tipo de cambio del dólar' 
      });
    }
    
    res.json({ 
      tipoCambio: parseFloat(configuracion.valor),
      descripcion: configuracion.descripcion,
      actualizado: configuracion.updatedAt
    });
  } catch (error) {
    console.error('Error obteniendo tipo de cambio:', error);
    res.status(500).json({ error: 'Error al obtener el tipo de cambio', details: error.message });
  }
};

// Establecer el tipo de cambio del dólar
exports.setTipoCambioUSD = async (req, res) => {
  const { tipoCambio, descripcion } = req.body;

  if (!tipoCambio || tipoCambio <= 0) {
    return res.status(400).json({ error: 'El tipo de cambio debe ser mayor a 0' });
  }

  try {
    const configuracion = await prisma.configuracion.upsert({
      where: { clave: 'tipo_cambio_usd' },
      update: {
        valor: tipoCambio.toString(),
        descripcion: descripcion || 'Tipo de cambio del dólar estadounidense',
        activo: true
      },
      create: {
        clave: 'tipo_cambio_usd',
        valor: tipoCambio.toString(),
        descripcion: descripcion || 'Tipo de cambio del dólar estadounidense',
        activo: true
      }
    });
    
    res.json({ 
      message: 'Tipo de cambio actualizado exitosamente',
      tipoCambio: parseFloat(configuracion.valor),
      actualizado: configuracion.updatedAt
    });
  } catch (error) {
    console.error('Error estableciendo tipo de cambio:', error);
    res.status(500).json({ error: 'Error al establecer el tipo de cambio', details: error.message });
  }
};
