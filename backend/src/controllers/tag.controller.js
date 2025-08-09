const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las etiquetas
const getAllTags = async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error) {
    console.error('Error al obtener etiquetas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear una nueva etiqueta
const createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la etiqueta es requerido' });
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#3B82F6'
      }
    });
    
    res.status(201).json(tag);
  } catch (error) {
    console.error('Error al crear etiqueta:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una etiqueta con ese nombre' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar una etiqueta
const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    const tag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data: {
        name,
        color
      }
    });
    
    res.json(tag);
  } catch (error) {
    console.error('Error al actualizar etiqueta:', error);
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una etiqueta con ese nombre' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar una etiqueta
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.tag.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar etiqueta:', error);
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una etiqueta por ID
const getTagById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!tag) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }
    
    res.json(tag);
  } catch (error) {
    console.error('Error al obtener etiqueta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getTagById
}; 