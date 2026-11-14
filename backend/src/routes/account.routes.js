const express = require('express');
const router = express.Router();
const controller = require('../controllers/account.controller');

// Listados
router.get('/saldos', controller.getAccountsConSaldos);
router.get('/para-pago', controller.getCuentasParaPago);

// Alta externa
router.post('/external', controller.createExternalAccountHandler);

// Detalle / resumen / líneas
router.get('/:id', controller.getAccountById);
router.get('/:id/resumen', controller.getAccountResumen);
router.get('/:id/cargos', controller.getAccountCargos);
router.get('/:id/pagos', controller.getAccountPagos);
router.post('/:id/cargos', controller.createAccountCargo);
router.post('/:id/pagos', controller.createAccountPago);

module.exports = router;
