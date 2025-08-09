const express = require('express');
const router = express.Router();
const openDayController = require('../controllers/openDay.controller');

// Rutas para días de apertura
router.get('/:hotelId', openDayController.getOpenDays);
router.post('/:hotelId', openDayController.createOpenDay);
router.post('/:hotelId/period', openDayController.createOpenDayPeriod);
router.put('/:id', openDayController.updateOpenDay);
router.delete('/:id', openDayController.deleteOpenDay);

module.exports = router; 