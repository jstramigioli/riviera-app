const express = require('express');
const seasonBlockController = require('../controllers/seasonBlock.controller');

const router = express.Router();

// GET /api/season-blocks - Listar todos los bloques de temporada
router.get('/', seasonBlockController.getAllSeasonBlocks);

// GET /api/season-blocks/:id/calculated-prices - Obtener precios calculados con redondeo
router.get('/:id/calculated-prices', seasonBlockController.getCalculatedPrices);

// GET /api/season-blocks/:id - Obtener un bloque de temporada específico
router.get('/:id', seasonBlockController.getSeasonBlockById);

// POST /api/season-blocks - Crear un nuevo bloque de temporada
router.post('/', seasonBlockController.createSeasonBlock);

// PUT /api/season-blocks/:id - Actualizar un bloque de temporada (cambios en borrador)
router.put('/:id', seasonBlockController.updateSeasonBlock);

// POST /api/season-blocks/:id/confirm - Confirmar cambios de un bloque de temporada
router.post('/:id/confirm', seasonBlockController.confirmSeasonBlock);

// DELETE /api/season-blocks/:id - Eliminar un bloque de temporada
router.delete('/:id', seasonBlockController.deleteSeasonBlock);

module.exports = router; 