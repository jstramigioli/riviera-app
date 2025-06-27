const express = require('express');
const roomController = require('../controllers/room.controller');
const { validateRoom } = require('../middlewares/validation');

const router = express.Router();

// GET /api/rooms - Listar todas las habitaciones
router.get('/', roomController.getAllRooms);

// GET /api/rooms/:id - Obtener una habitación específica
router.get('/:id', roomController.getRoomById);

// POST /api/rooms - Crear una nueva habitación
router.post('/', validateRoom, roomController.createRoom);

// PUT /api/rooms/:id - Actualizar una habitación
router.put('/:id', validateRoom, roomController.updateRoom);

// DELETE /api/rooms/:id - Eliminar una habitación
router.delete('/:id', roomController.deleteRoom);

module.exports = router; 