const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotel.controller');

// Obtener información del hotel
router.get('/', hotelController.getHotel);

// Crear o actualizar información del hotel
router.put('/', hotelController.updateHotel);

// Eliminar hotel (desactivar)
router.delete('/:id', hotelController.deleteHotel);

module.exports = router; 