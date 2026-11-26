const express = require('express');
const { requirePermission } = require('../middlewares/auth');
const controller = require('../controllers/comidas.controller');

const router = express.Router();

// Lectura: cualquier usuario autenticado (recuento de comensales).
router.get('/', controller.getComidasDelDia);
router.get('/reserva/:reservationId', controller.getComidasDeReserva);

// Gestión de comensales: mismos roles que Gastronomía.
const gestion = requirePermission('gastronomia');
router.post('/cenas', gestion, controller.crearCenaManual);
router.patch('/:id', gestion, controller.actualizarComida);
router.post('/:id/cancelar', gestion, controller.cancelarComida);
router.post('/:id/reactivar', gestion, controller.reactivarComida);

// Beneficios (Almuerzo sin cargo): anulación manual y su reversión.
router.post('/beneficios/:id/anular', gestion, controller.anularBeneficio);
router.post('/beneficios/:id/restaurar', gestion, controller.restaurarBeneficio);

module.exports = router;
