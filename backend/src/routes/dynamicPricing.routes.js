const express = require('express');
const router = express.Router();
const dynamicPricingController = require('../controllers/dynamicPricing.controller');

// Configuración de precios dinámicos
router.get('/config/:hotelId', dynamicPricingController.getDynamicPricingConfig);
router.put('/config/:hotelId', dynamicPricingController.upsertDynamicPricingConfig);

// Keyframes estacionales
router.get('/keyframes/:hotelId', dynamicPricingController.getSeasonalKeyframes);
router.post('/keyframes/:hotelId', dynamicPricingController.createSeasonalKeyframe);
router.put('/keyframes/:id', dynamicPricingController.updateSeasonalKeyframe);
router.delete('/keyframes/:id', dynamicPricingController.deleteSeasonalKeyframe);
router.delete('/keyframes/:hotelId/all', dynamicPricingController.deleteAllSeasonalKeyframes);

// Tarifas dinámicas
router.get('/rates/:hotelId/:roomTypeId', dynamicPricingController.getDynamicRates);
router.post('/rates/:hotelId/:roomTypeId/generate', dynamicPricingController.generateDynamicRates);
router.put('/rates/:hotelId/:roomTypeId/:date', dynamicPricingController.updateRateManually);

// Reglas de precios de comidas
router.get('/meals/:hotelId', dynamicPricingController.getMealPricingRules);
router.put('/meals/:hotelId', dynamicPricingController.upsertMealPricingRules);

// Promociones por huecos
router.get('/gap-promotions/:roomId/:date', dynamicPricingController.getGapPromotions);
router.post('/gap-promotions/:roomId/:date', dynamicPricingController.applyGapPromotion);

// Cálculo de scores
router.post('/calculate-score/:hotelId/:date', dynamicPricingController.calculateOccupancyScore);

module.exports = router; 