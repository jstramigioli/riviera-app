const express = require('express');
const reservationController = require('../controllers/reservation.controller');
const { validateReservation } = require('../middlewares/validation');

const router = express.Router();

// GET /api/reservations - Listar todas las reservas
router.get('/', reservationController.getAllReservations);

// GET /api/reservations/available-rooms - Buscar habitaciones disponibles según requerimientos
router.get('/available-rooms', reservationController.findAvailableRooms);

// GET /api/reservations/:id - Obtener una reserva específica
router.get('/:id', reservationController.getReservationById);

// GET /api/reservations/:id/pricing - Obtener tarifas detalladas de una reserva
router.get('/:id/pricing', reservationController.getReservationPricingDetails);

// POST /api/reservations - Crear una nueva reserva
router.post('/', validateReservation, reservationController.createReservation);

// PUT /api/reservations/:id - Actualizar una reserva
router.put('/:id', validateReservation, reservationController.updateReservation);

// DELETE /api/reservations/:id - Eliminar una reserva
router.delete('/:id', reservationController.deleteReservation);

module.exports = router; 