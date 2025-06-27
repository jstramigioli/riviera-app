const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');

// Listar todos los huéspedes
router.get('/', guestController.getAllGuests);

// Obtener un huésped por ID
router.get('/:id', guestController.getGuestById);

// Actualizar un huésped
router.put('/:id', guestController.updateGuest);

// Calcular balance de un huésped
router.get('/:id/balance', guestController.getGuestBalance);

module.exports = router; 