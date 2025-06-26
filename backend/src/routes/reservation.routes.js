const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');

// Listar todas las reservas
router.get('/', reservationController.getAllReservations);

// Crear una reserva
router.post('/', reservationController.createReservation);

// Actualizar una reserva
router.put('/:id', reservationController.updateReservation);

module.exports = router; 