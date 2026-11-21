const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../controllers/reservationCobros.controller');
const { requirePermission } = require('../middlewares/auth');
const { ADJUNTO_TIPOS } = require('../utils/cobroAdjuntos');

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

// Obtener todas las reservas con sus saldos (alias Account RESERVATION)
router.get('/reservas-saldos', controller.getReservasConSaldos);

// Opciones Select del modal Nuevo cobro (activas, no solo ocupación de hoy)
router.get('/reservas-para-cobro', controller.getReservasParaCobro);

// Alias Account: listado unificado y opciones de cobro
const accountController = require('../controllers/account.controller');
router.get('/accounts-saldos', accountController.getAccountsConSaldos);
router.get('/cuentas-para-cobro', accountController.getCuentasParaCobro);

// Obtener resumen financiero de una reserva específica
router.get('/reservas/:reservaId/resumen', controller.getResumenFinanciero);

// Obtener el tipo de cambio actual para nuevos cobros
router.get('/tipo-cambio-actual', controller.getTipoCambioActual);

// ============================================
// RUTAS DE COBROS
// ============================================

// Historial global de cobros
router.get('/cobros', controller.getAllCobros);

// Obtener todos los cobros de una reserva
router.get('/reservas/:reservaId/cobros', controller.getCobrosByReserva);

// Crear un nuevo cobro para una reserva
router.post('/reservas/:reservaId/cobros', controller.createCobro);

// Actualizar un cobro existente
router.put('/cobros/:id', controller.updateCobro);

// Eliminar un cobro
router.delete('/cobros/:id', controller.deleteCobro);

// Adjuntos factura (PDF, admin) / comprobante transferencia (JPG/PNG/PDF)
router.post(
  '/cobros/:id/adjuntos/:tipo',
  requireFacturaUploadIfNeeded,
  upload.array('files', 20),
  controller.uploadCobroAdjuntos
);
router.get('/cobros/:id/adjuntos/:adjuntoId/download', controller.downloadCobroAdjunto);
router.delete('/cobros/:id/adjuntos/:adjuntoId', controller.deleteCobroAdjunto);

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


