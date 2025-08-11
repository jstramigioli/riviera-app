const express = require('express');
const roundingConfigController = require('../controllers/roundingConfig.controller');

const router = express.Router();

// GET /api/rounding-config - Obtener configuración de redondeo
router.get('/', roundingConfigController.getRoundingConfig);

// PUT /api/rounding-config - Actualizar configuración de redondeo
router.put('/', roundingConfigController.updateRoundingConfig);

module.exports = router; 