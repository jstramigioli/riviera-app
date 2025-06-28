const express = require('express');
const router = express.Router();
const {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getTagById
} = require('../controllers/tag.controller');

// Obtener todas las etiquetas
router.get('/', getAllTags);

// Obtener una etiqueta por ID
router.get('/:id', getTagById);

// Crear una nueva etiqueta
router.post('/', createTag);

// Actualizar una etiqueta
router.put('/:id', updateTag);

// Eliminar una etiqueta
router.delete('/:id', deleteTag);

module.exports = router; 