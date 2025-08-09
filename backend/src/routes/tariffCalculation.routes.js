const express = require('express');
const tariffCalculationController = require('../controllers/tariffCalculation.controller');

const router = express.Router();

// GET /api/tariff-calculations/season-block/:seasonBlockId - Calcular tarifas para un bloque específico
router.get('/season-block/:seasonBlockId', tariffCalculationController.calculateSeasonBlockTariffs);

// GET /api/tariff-calculations/date - Obtener tarifas para una fecha específica
router.get('/date', tariffCalculationController.getTariffsForDate);

// GET /api/tariff-calculations/prices-by-date - Obtener matriz de precios por fecha
router.get('/prices-by-date', tariffCalculationController.getPricesByDate);

// POST /api/tariff-calculations/compare - Comparar tarifas entre bloques
router.post('/compare', tariffCalculationController.compareTariffsBetweenBlocks);

module.exports = router; 