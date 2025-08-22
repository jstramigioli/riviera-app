const express = require('express');
const router = express.Router();
const {
  createMultiRoomReservation,
  getMultiRoomReservations,
  getMultiRoomReservationById,
  updateMultiRoomReservation,
  deleteMultiRoomReservation
} = require('../controllers/multiRoomReservation.controller');

// Rutas para reservas multi-habitación
router.get('/', getMultiRoomReservations);
router.get('/:id', getMultiRoomReservationById);
router.post('/', createMultiRoomReservation);
router.put('/:id', updateMultiRoomReservation);
router.delete('/:id', deleteMultiRoomReservation);

module.exports = router; 