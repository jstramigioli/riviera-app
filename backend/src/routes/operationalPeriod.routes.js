const express = require('express');
const router = express.Router();
const operationalPeriodController = require('../controllers/operationalPeriod.controller');

// Rutas para períodos operacionales
router.get('/:hotelId', operationalPeriodController.getOperationalPeriods);
router.get('/:hotelId/availability', operationalPeriodController.checkHotelAvailability);
router.post('/:hotelId', operationalPeriodController.createOperationalPeriod);
router.put('/:id', operationalPeriodController.updateOperationalPeriod);
router.delete('/:id', operationalPeriodController.deleteOperationalPeriod);

module.exports = router; 