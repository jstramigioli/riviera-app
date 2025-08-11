const express = require('express');
const router = express.Router();
const {
  getBlockServiceTypes,
  getBlockServiceType,
  createBlockServiceType,
  updateBlockServiceType,
  deleteBlockServiceType,
  reorderBlockServiceTypes
} = require('../controllers/blockServiceType.controller');

// Obtener todos los tipos de servicio de un bloque
router.get('/block/:seasonBlockId', getBlockServiceTypes);

// Obtener un tipo de servicio específico
router.get('/:id', getBlockServiceType);

// Crear un nuevo tipo de servicio para el bloque
router.post('/', createBlockServiceType);

// Actualizar un tipo de servicio del bloque
router.put('/:id', updateBlockServiceType);

// Eliminar un tipo de servicio del bloque
router.delete('/:id', deleteBlockServiceType);

// Reordenar los tipos de servicio del bloque
router.post('/block/:seasonBlockId/reorder', reorderBlockServiceTypes);

module.exports = router; 