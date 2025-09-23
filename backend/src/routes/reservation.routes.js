const express = require('express');
const reservationController = require('../controllers/reservation.controller');
const { validateReservation, validateMultiSegmentReservation } = require('../middlewares/validation');
const { validateReservationStatusMiddleware } = require('../middlewares/reservationStatusValidation');

const router = express.Router();

// GET /api/reservations - Listar todas las reservas
router.get('/', reservationController.getAllReservations);

// GET /api/reservations/available-rooms - Buscar habitaciones disponibles según requerimientos
router.get('/available-rooms', reservationController.findAvailableRooms);

// GET /api/reservations/:id/pricing - Obtener tarifas detalladas de una reserva
router.get('/:id/pricing', reservationController.getReservationPricingDetails);

// GET /api/reservations/:id - Obtener una reserva específica
router.get('/:id', reservationController.getReservationById);

// POST /api/reservations - Crear una nueva reserva
router.post('/', validateReservation, validateReservationStatusMiddleware, reservationController.createReservation);

// POST /api/reservations/multi-segment - Crear una reserva con segmentos múltiples
router.post('/multi-segment', validateMultiSegmentReservation, validateReservationStatusMiddleware, reservationController.createMultiSegmentReservation);

// PATCH /api/reservations/:id/status - Actualizar solo el estado de una reserva
router.patch('/:id/status', validateReservationStatusMiddleware, reservationController.updateReservationStatus);

// PUT /api/reservations/:id - Actualizar una reserva
router.put('/:id', validateReservation, validateReservationStatusMiddleware, reservationController.updateReservation);

// DELETE /api/reservations/:id - Eliminar una reserva
router.delete('/:id', reservationController.deleteReservation);

module.exports = router; 