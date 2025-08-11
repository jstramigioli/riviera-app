const express = require('express');
const router = express.Router();
const {
  getBlockServiceSelections,
  getBlockServiceSelection,
  createBlockServiceSelection,
  updateBlockServiceSelection,
  deleteBlockServiceSelection,
  reorderBlockServiceSelections,
  getAvailableServices
} = require('../controllers/blockServiceSelection.controller');

// Obtener todas las selecciones de servicios de un bloque
router.get('/block/:seasonBlockId', getBlockServiceSelections);

// Obtener servicios disponibles para un bloque
router.get('/block/:seasonBlockId/available', getAvailableServices);

// Obtener una selección específica
router.get('/:id', getBlockServiceSelection);

// Crear una nueva selección de servicio
router.post('/', createBlockServiceSelection);

// Actualizar una selección de servicio
router.put('/:id', updateBlockServiceSelection);

// Eliminar una selección de servicio
router.delete('/:id', deleteBlockServiceSelection);

// Reordenar selecciones de servicios
router.post('/block/:seasonBlockId/reorder', reorderBlockServiceSelections);

module.exports = router; 