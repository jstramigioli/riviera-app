const express = require('express');
const seasonBlockController = require('../controllers/seasonBlock.controller');

const router = express.Router();

// GET /api/season-blocks - Listar todos los bloques de temporada
router.get('/', seasonBlockController.getAllSeasonBlocks);

// PUT /api/season-blocks/order - Actualizar el orden de los bloques de temporada
router.put('/order', seasonBlockController.updateSeasonBlocksOrder);

// GET /api/season-blocks/:id - Obtener un bloque de temporada específico
router.get('/:id', seasonBlockController.getSeasonBlockById);

// POST /api/season-blocks - Crear un nuevo bloque de temporada
router.post('/', seasonBlockController.createSeasonBlock);

// PUT /api/season-blocks/:id - Actualizar un bloque de temporada
router.put('/:id', seasonBlockController.updateSeasonBlock);

// DELETE /api/season-blocks/:id - Eliminar un bloque de temporada
router.delete('/:id', seasonBlockController.deleteSeasonBlock);

module.exports = router; 