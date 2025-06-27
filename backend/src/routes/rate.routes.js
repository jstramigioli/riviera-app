const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rate.controller');

router.get('/rates', rateController.getRates);
router.post('/rates', rateController.createRates);
router.patch('/rates/:id', rateController.updateRate);
router.delete('/rates/:id', rateController.deleteRate);
// Endpoint opcional para sugerir precio dinámico
router.post('/rates/suggest', rateController.suggestDynamicPrice);

module.exports = router; 