const express = require('express');
const router = express.Router();
const {
  getAllOpenDays,
  getOpenDayById,
  getOpenDayByDate,
  createOpenDay,
  updateOpenDay,
  updateOpenDayByDate,
  deleteOpenDay,
  getPriceForDateEndpoint,
  getPriceForRoomTypeEndpoint,
  getPricesForAllRoomTypesEndpoint
} = require('../controllers/openDay.controller');

// Obtener todos los días abiertos
router.get('/', getAllOpenDays);

// Obtener un día abierto por ID
router.get('/:id', getOpenDayById);

// Obtener un día abierto por fecha (formato: YYYY-MM-DD)
router.get('/date/:date', getOpenDayByDate);

// Obtener precio para una fecha específica
router.get('/price/:date', getPriceForDateEndpoint);

// Obtener precio para un tipo de habitación en una fecha específica
router.get('/price/:date/room-type/:roomTypeId', getPriceForRoomTypeEndpoint);

// Obtener precios de todos los tipos de habitación en una fecha
router.get('/prices/:date/room-types', getPricesForAllRoomTypesEndpoint);

// Crear un nuevo día abierto
router.post('/', createOpenDay);

// Actualizar un día abierto por ID
router.put('/:id', updateOpenDay);

// Actualizar un día abierto por fecha
router.put('/date/:date', updateOpenDayByDate);

// Eliminar un día abierto
router.delete('/:id', deleteOpenDay);

module.exports = router; 