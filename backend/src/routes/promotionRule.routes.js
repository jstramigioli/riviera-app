const express = require('express');
const router = express.Router();
const controller = require('../controllers/promotionRule.controller');
const { requirePermission } = require('../middlewares/auth');

router.get('/', controller.listPromotionRules);
router.post('/preview', requirePermission('finanzas'), controller.previewPromotion);
router.get('/:id', controller.getPromotionRule);
router.post('/', requirePermission('promociones'), controller.createPromotionRule);
router.put('/:id', requirePermission('promociones'), controller.updatePromotionRule);
router.delete('/:id', requirePermission('promociones'), controller.deletePromotionRule);

module.exports = router;
