const express = require('express');
const roomTypeController = require('../controllers/roomType.controller');

const router = express.Router();

// GET /api/room-types - Listar todos los tipos de habitación
router.get('/', roomTypeController.getAllRoomTypes);

// GET /api/room-types/:id - Obtener un tipo de habitación específico
router.get('/:id', roomTypeController.getRoomTypeById);

// POST /api/room-types - Crear un nuevo tipo de habitación
router.post('/', roomTypeController.createRoomType);

// PUT /api/room-types/order - Actualizar el orden de los tipos de habitación
router.put('/order', roomTypeController.updateRoomTypesOrder);

// PUT /api/room-types/:id - Actualizar un tipo de habitación
router.put('/:id', roomTypeController.updateRoomType);

// DELETE /api/room-types/:id - Eliminar un tipo de habitación
router.delete('/:id', roomTypeController.deleteRoomType);

module.exports = router; 