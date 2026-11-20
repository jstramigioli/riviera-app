const express = require('express');
const controller = require('../controllers/paymentMethodConfig.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Lectura: cualquier rol con finanzas (cobro / preview)
router.get('/', controller.listPaymentMethodConfigs);
router.get('/:id', controller.getPaymentMethodConfig);

// Escritura: admin y gerencia
router.post('/', requirePermission('mediosPago'), controller.createPaymentMethodConfig);
router.put('/:id', requirePermission('mediosPago'), controller.updatePaymentMethodConfig);

module.exports = router;
