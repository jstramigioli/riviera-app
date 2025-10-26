const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');

// Listar todos los huéspedes
router.get('/', guestController.getAllGuests);

// Obtener un huésped por ID
router.get('/:id', guestController.getGuestById);

// Crear un nuevo huésped
router.post('/', guestController.createGuest);

// Actualizar un huésped
router.put('/:id', guestController.updateGuest);

// Eliminar un huésped
router.delete('/:id', guestController.deleteGuest);

// Calcular balance de un huésped
router.get('/:id/balance', guestController.getGuestBalance);

module.exports = router; 