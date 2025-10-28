const express = require('express');
const router = express.Router();

const {
  getCombinacionesAlojamiento,
  getRoomTypes,
  getServiceTypes
} = require('../controllers/alojamientoController');

// GET /api/alojamiento/combinaciones - Obtener todas las combinaciones dinámicas
router.get('/combinaciones', getCombinacionesAlojamiento);

// GET /api/alojamiento/room-types - Obtener tipos de habitación
router.get('/room-types', getRoomTypes);

// GET /api/alojamiento/service-types - Obtener tipos de servicio
router.get('/service-types', getServiceTypes);

module.exports = router;
