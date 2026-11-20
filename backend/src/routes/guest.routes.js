const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');

// Listar todos los huéspedes
router.get('/', guestController.getAllGuests);

// Rutas estáticas antes de /:id
router.post('/from-holder', guestController.addHolderAsGuest);
router.post('/from-client', guestController.addGuestFromClient);

// Crear un nuevo huésped
router.post('/', guestController.createGuest);

// Calcular balance de un huésped
router.get('/:id/balance', guestController.getGuestBalance);

// Obtener un huésped por ID
router.get('/:id', guestController.getGuestById);

// Actualizar un huésped
router.put('/:id', guestController.updateGuest);

// Eliminar un huésped
router.delete('/:id', guestController.deleteGuest);

module.exports = router;
