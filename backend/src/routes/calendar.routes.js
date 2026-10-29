const express = require('express');
const calendarController = require('../controllers/calendar.controller');

const router = express.Router();

// GET /api/calendar?start=YYYY-MM-DD&days=N
router.get('/', calendarController.getCalendar);

module.exports = router;
