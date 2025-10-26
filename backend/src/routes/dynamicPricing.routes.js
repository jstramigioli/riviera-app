const express = require('express');
const router = express.Router();
const dynamicPricingController = require('../controllers/dynamicPricing.controller');

// Configuración de precios dinámicos
router.get('/config/:hotelId', dynamicPricingController.getConfig);
router.put('/config/:hotelId', dynamicPricingController.updateConfig);
router.get('/max-adjustments/:hotelId', dynamicPricingController.getMaxAdjustmentPercentages);



// Rutas para keyframes operacionales
router.post('/operational-keyframes/:hotelId', dynamicPricingController.createOperationalKeyframes);
router.put('/operational-keyframes/:periodId', dynamicPricingController.updateOperationalKeyframes);
router.delete('/operational-keyframes/:periodId', dynamicPricingController.deleteOperationalKeyframes);
// router.put('/operational-keyframes/:id/price', dynamicPricingController.updateOperationalKeyframePrice); // TODO: Implementar método

// Tarifas dinámicas
router.get('/rates/:hotelId/:roomTypeId', dynamicPricingController.getDynamicRates);
router.get('/calculated-rates/:hotelId/:roomTypeId', dynamicPricingController.getCalculatedRates);
router.post('/rates/:hotelId/:roomTypeId/generate', dynamicPricingController.generateDynamicRates);
router.put('/rates/:hotelId/:roomTypeId/:date', dynamicPricingController.updateDynamicRate);



// Reglas de precios de comidas
router.get('/meals/:hotelId', dynamicPricingController.getMealPricingRules);
router.put('/meals/:hotelId', dynamicPricingController.upsertMealPricingRules);

// Promociones por huecos
router.get('/gap-promotions/:roomId/:date', dynamicPricingController.getGapPromotions);
router.post('/gap-promotions/:roomId/:date', dynamicPricingController.applyGapPromotion);

// Cálculo de scores
router.post('/calculate-score/:hotelId/:date', dynamicPricingController.calculateOccupancyScore);
router.get('/occupancy-score', dynamicPricingController.getOccupancyScore);
router.post('/detailed-occupancy-score', dynamicPricingController.getDetailedOccupancyScore);

// Verificación de feriados/fines de semana largos
router.get('/long-weekend-check', dynamicPricingController.checkLongWeekendOrHoliday);

module.exports = router; 