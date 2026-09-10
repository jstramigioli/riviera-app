const express = require('express');
const router = express.Router();
const controller = require('../controllers/configuracion.controller');

// Rutas específicas ANTES de /:clave para evitar captura incorrecta
router.get('/tipo-cambio/usd', controller.getTipoCambioUSD);
router.post('/tipo-cambio/usd', controller.setTipoCambioUSD);

router.get('/', controller.getConfiguraciones);
router.post('/', controller.upsertConfiguracion);
router.get('/:clave', controller.getConfiguracionByClave);
router.put('/:clave', controller.updateConfiguracion);
router.delete('/:clave', controller.deleteConfiguracion);

module.exports = router;
