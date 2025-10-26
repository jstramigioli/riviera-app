const express = require('express');
const router = express.Router();
const controller = require('../controllers/configuracion.controller');

// ============================================
// RUTAS DE CONFIGURACIÓN GENERAL
// ============================================

// Obtener todas las configuraciones
router.get('/', controller.getConfiguraciones);

// Obtener una configuración específica por clave
router.get('/:clave', controller.getConfiguracionByClave);

// Crear o actualizar una configuración
router.post('/', controller.upsertConfiguracion);

// Actualizar una configuración existente
router.put('/:clave', controller.updateConfiguracion);

// Eliminar una configuración (marcar como inactiva)
router.delete('/:clave', controller.deleteConfiguracion);

// ============================================
// RUTAS ESPECÍFICAS PARA TIPO DE CAMBIO
// ============================================

// Obtener el tipo de cambio actual del dólar
router.get('/tipo-cambio/usd', controller.getTipoCambioUSD);

// Establecer el tipo de cambio del dólar
router.post('/tipo-cambio/usd', controller.setTipoCambioUSD);

module.exports = router;
