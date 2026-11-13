const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../controllers/reservationPayments.controller');
const { requirePermission } = require('../middlewares/auth');
const { ADJUNTO_TIPOS } = require('../utils/pagoAdjuntos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});

/** Subida de PDF de factura: solo admin (permiso facturacion). */
function requireFacturaUploadIfNeeded(req, res, next) {
  const tipo = String(req.params.tipo || '').toUpperCase();
  if (tipo === ADJUNTO_TIPOS.FACTURA) {
    return requirePermission('facturacion')(req, res, next);
  }
  return next();
}

// ============================================
// RUTAS DE RESUMEN Y LISTADOS GENERALES
// ============================================

// Obtener todas las reservas con sus saldos
router.get('/reservas-saldos', controller.getReservasConSaldos);

// Opciones Select del modal Nuevo pago (activas, no solo ocupación de hoy)
router.get('/reservas-para-pago', controller.getReservasParaPago);

// Obtener resumen financiero de una reserva específica
router.get('/reservas/:reservaId/resumen', controller.getResumenFinanciero);

// Obtener el tipo de cambio actual para nuevos pagos
router.get('/tipo-cambio-actual', controller.getTipoCambioActual);

// ============================================
// RUTAS DE PAGOS
// ============================================

// Historial global de pagos
router.get('/pagos', controller.getAllPagos);

// Obtener todos los pagos de una reserva
router.get('/reservas/:reservaId/pagos', controller.getPagosByReserva);

// Crear un nuevo pago para una reserva
router.post('/reservas/:reservaId/pagos', controller.createPago);

// Actualizar un pago existente
router.put('/pagos/:id', controller.updatePago);

// Eliminar un pago
router.delete('/pagos/:id', controller.deletePago);

// Adjuntos factura (PDF, admin) / comprobante transferencia (JPG/PNG/PDF)
router.post(
  '/pagos/:id/adjuntos/:tipo',
  requireFacturaUploadIfNeeded,
  upload.array('files', 20),
  controller.uploadPagoAdjuntos
);
router.get('/pagos/:id/adjuntos/:adjuntoId/download', controller.downloadPagoAdjunto);
router.delete('/pagos/:id/adjuntos/:adjuntoId', controller.deletePagoAdjunto);

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


