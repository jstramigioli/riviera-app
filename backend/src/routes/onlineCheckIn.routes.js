const express = require('express');
const {
  getReservationCheckIn,
  sendReservationCheckIn
} = require('../controllers/onlineCheckIn.controller');

const router = express.Router({ mergeParams: true });

// Montado bajo /api/reservations/:id/check-in (con auth reservas)
router.get('/', getReservationCheckIn);
router.post('/send', sendReservationCheckIn);

module.exports = router;
