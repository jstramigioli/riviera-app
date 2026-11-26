const express = require('express');
const router = express.Router();
const {
  getReservationSegments,
  getSegmentById,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentsByDateRange,
  autoSplitReservation
} = require('../controllers/reservationSegment.controller');

// Rutas para segmentos de una reserva específica
router.get('/reservation/:reservationId', getReservationSegments);
router.post('/reservation/:reservationId/split', autoSplitReservation);

// Rango de fechas: antes de '/:id' (si no, Express lo toma como id="by-date-range")
router.get('/by-date-range', getSegmentsByDateRange);

// Rutas para segmentos individuales
router.get('/:id', getSegmentById);
router.post('/', createSegment);
router.put('/:id', updateSegment);
router.delete('/:id', deleteSegment);

module.exports = router; 