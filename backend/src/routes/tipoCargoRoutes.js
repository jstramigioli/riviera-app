const express = require('express');
const router = express.Router();

const {
  getTiposCargo,
  getTiposCargoPersonalizables,
  getTipoCargo,
  createTipoCargo,
  updateTipoCargo,
  deleteTipoCargo,
  toggleTipoCargo
} = require('../controllers/tipoCargoController');

// GET /api/tipo-cargo - Obtener todos los tipos (hardcoded + personalizables)
router.get('/', getTiposCargo);

// GET /api/tipo-cargo/personalizables - Solo tipos personalizables
router.get('/personalizables', getTiposCargoPersonalizables);

// GET /api/tipo-cargo/:id - Obtener tipo específico
router.get('/:id', getTipoCargo);

// POST /api/tipo-cargo - Crear nuevo tipo personalizable
router.post('/', createTipoCargo);

// PUT /api/tipo-cargo/:id - Actualizar tipo
router.put('/:id', updateTipoCargo);

// PUT /api/tipo-cargo/:id/toggle - Activar/desactivar
router.put('/:id/toggle', toggleTipoCargo);

// DELETE /api/tipo-cargo/:id - Eliminar tipo personalizable
router.delete('/:id', deleteTipoCargo);

module.exports = router;
