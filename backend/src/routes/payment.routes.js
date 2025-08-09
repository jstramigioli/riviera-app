const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Listar todos los pagos
router.get('/', paymentController.getAllPayments);

// Obtener pagos de un huésped específico
router.get('/guest/:guestId', paymentController.getPaymentsByGuest);

// Crear un nuevo pago o cargo
router.post('/', paymentController.createPayment);

// Actualizar un pago
router.put('/:id', paymentController.updatePayment);

// Eliminar un pago
router.delete('/:id', paymentController.deletePayment);

// Crear cargo automático por reserva
router.post('/reservation-charge', paymentController.createReservationCharge);

// Crear cargo por consumo
router.post('/consumption-charge', paymentController.createConsumptionCharge);

module.exports = router; 