const express = require('express');
const {
  getOccupiedRoomsToday,
  createConsumptionOrder
} = require('../controllers/consumption.controller');

const router = express.Router();

router.get('/occupied-rooms', getOccupiedRoomsToday);
router.post('/orders', createConsumptionOrder);

module.exports = router;
