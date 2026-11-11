const express = require('express');
const {
  getPublicCheckIn,
  submitPublicCheckIn
} = require('../controllers/onlineCheckIn.controller');

const router = express.Router();

// Público — sin auth
router.get('/:token', getPublicCheckIn);
router.post('/:token', submitPublicCheckIn);

module.exports = router;
