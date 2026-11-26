const express = require('express');
const {
  getOccupiedRoomsToday,
  createConsumptionOrder,
  anularConsumptionOrder
} = require('../controllers/consumption.controller');

const router = express.Router();

router.get('/occupied-rooms', getOccupiedRoomsToday);
router.post('/orders', createConsumptionOrder);
router.post('/orders/:id/anular', anularConsumptionOrder);

module.exports = router;
