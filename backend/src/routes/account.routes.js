const express = require('express');
const router = express.Router();
const controller = require('../controllers/account.controller');

// Listados
router.get('/saldos', controller.getAccountsConSaldos);
router.get('/para-cobro', controller.getCuentasParaCobro);

// Alta externa
router.post('/external', controller.createExternalAccountHandler);

// Detalle / resumen / líneas
router.get('/:id', controller.getAccountById);
router.get('/:id/resumen', controller.getAccountResumen);
router.get('/:id/cargos', controller.getAccountCargos);
router.get('/:id/cobros', controller.getAccountCobros);
router.post('/:id/cargos', controller.createAccountCargo);
router.post('/:id/cobros', controller.createAccountCobro);

module.exports = router;
