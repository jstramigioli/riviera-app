const express = require('express');
const { requirePermission } = require('../middlewares/auth');
const controller = require('../controllers/cenas.controller');

const router = express.Router();

// Lectura: cualquier usuario autenticado (cargar cenas / comandas).
router.get('/tipos', controller.listTipos);
// Escritura: Configuración.
router.post('/tipos', requirePermission('settings'), controller.createTipo);
router.put('/tipos/:id', requirePermission('settings'), controller.updateTipo);
router.delete('/tipos/:id', requirePermission('settings'), controller.deleteTipo);

module.exports = router;
