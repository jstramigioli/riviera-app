const express = require('express');
const router = express.Router();
const {
  getVirtualRooms,
  getVirtualRoomById,
  createVirtualRoom,
  updateVirtualRoom,
  deleteVirtualRoom
} = require('../controllers/virtualRoom.controller');

// Rutas para habitaciones virtuales
router.get('/', getVirtualRooms);
router.get('/:id', getVirtualRoomById);
router.post('/', createVirtualRoom);
router.put('/:id', updateVirtualRoom);
router.delete('/:id', deleteVirtualRoom);

module.exports = router; 