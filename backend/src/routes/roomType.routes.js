const express = require('express');
const roomTypeController = require('../controllers/roomType.controller');

const router = express.Router();

// GET /api/room-types - Listar todos los tipos de habitación
router.get('/', roomTypeController.getAllRoomTypes);

// PUT /api/room-types/order - Actualizar el orden de los tipos de habitación
router.put('/order', roomTypeController.updateRoomTypesOrder);

// GET /api/room-types/:hotelId/coefficients - Obtener coeficientes por hotel
router.get('/:hotelId/coefficients', roomTypeController.getCoefficientsByHotel);

// PUT /api/room-types/:hotelId/coefficients - Actualizar coeficientes por hotel
router.put('/:hotelId/coefficients', roomTypeController.updateCoefficientsByHotel);

// GET /api/room-types/:hotelId - Obtener tipos de habitación por hotel
router.get('/:hotelId', roomTypeController.getRoomTypesByHotel);

// POST /api/room-types - Crear un nuevo tipo de habitación
router.post('/', roomTypeController.createRoomType);

// PUT /api/room-types/:id - Actualizar un tipo de habitación
router.put('/:id', roomTypeController.updateRoomType);

// DELETE /api/room-types/:id - Eliminar un tipo de habitación
router.delete('/:id', roomTypeController.deleteRoomType);

module.exports = router; 