const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');

// Listar todas las habitaciones
router.get('/', roomController.getAllRooms);

// Editar una habitación (por ejemplo, etiquetas, descripción, estado)
router.patch('/:id', roomController.updateRoom);

module.exports = router; 