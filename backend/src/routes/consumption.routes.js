const express = require('express');
const {
  getOccupiedRoomsToday,
  createConsumptionOrder,
  anularConsumptionOrder,
  getConsumptionOrder,
  addItemsToConsumptionOrder
} = require('../controllers/consumption.controller');

const router = express.Router();

router.get('/occupied-rooms', getOccupiedRoomsToday);
router.post('/orders', createConsumptionOrder);
router.post('/orders/:id/anular', anularConsumptionOrder);
router.get('/orders/:id', getConsumptionOrder);
router.post('/orders/:id/items', addItemsToConsumptionOrder);

module.exports = router;
