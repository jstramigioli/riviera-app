const express = require('express');
const router = express.Router();
const controller = require('../controllers/reservationPayments.controller');

// ============================================
// RUTAS DE RESUMEN Y LISTADOS GENERALES
// ============================================

// Obtener todas las reservas con sus saldos
router.get('/reservas-saldos', controller.getReservasConSaldos);

// Obtener resumen financiero de una reserva específica
router.get('/reservas/:reservaId/resumen', controller.getResumenFinanciero);

// Obtener el tipo de cambio actual para nuevos pagos
router.get('/tipo-cambio-actual', controller.getTipoCambioActual);

// ============================================
// RUTAS DE PAGOS
// ============================================

// Obtener todos los pagos de una reserva
router.get('/reservas/:reservaId/pagos', controller.getPagosByReserva);

// Crear un nuevo pago para una reserva
router.post('/reservas/:reservaId/pagos', controller.createPago);

// Actualizar un pago existente
router.put('/pagos/:id', controller.updatePago);

// Eliminar un pago
router.delete('/pagos/:id', controller.deletePago);

// ============================================
// RUTAS DE CARGOS
// ============================================

// Obtener todos los cargos de una reserva
router.get('/reservas/:reservaId/cargos', controller.getCargosByReserva);

// Crear un nuevo cargo para una reserva
router.post('/reservas/:reservaId/cargos', controller.createCargo);

// Actualizar un cargo existente
router.put('/cargos/:id', controller.updateCargo);

// Eliminar un cargo
router.delete('/cargos/:id', controller.deleteCargo);

module.exports = router;


