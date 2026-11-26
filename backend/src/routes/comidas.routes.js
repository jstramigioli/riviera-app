const express = require('express');
const { requirePermission } = require('../middlewares/auth');
const controller = require('../controllers/comidas.controller');

const router = express.Router();

// Lectura: cualquier usuario autenticado (recuento de comensales).
router.get('/', controller.getComidasDelDia);

// Gestión de comensales: mismos roles que Gastronomía.
const gestion = requirePermission('gastronomia');
router.post('/cenas', gestion, controller.crearCenaManual);
router.patch('/:id', gestion, controller.actualizarComida);
router.post('/:id/cancelar', gestion, controller.cancelarComida);
router.post('/:id/reactivar', gestion, controller.reactivarComida);

module.exports = router;
