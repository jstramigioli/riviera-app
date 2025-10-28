const express = require('express');
const router = express.Router();

const {
  getSubcategorias,
  getTiposHardcoded,
  getSubcategoriasPersonalizables,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
  toggleSubcategoria
} = require('../controllers/subcategoriaCargoController');

// GET /api/subcategoria-cargo - Obtener todas las subcategorías (opcionalmente filtradas por tipo)
router.get('/', getSubcategorias);

// GET /api/subcategoria-cargo/tipos - Obtener tipos hardcoded con información
router.get('/tipos', getTiposHardcoded);

// GET /api/subcategoria-cargo/:tipo/personalizables - Solo subcategorías personalizables de un tipo
router.get('/:tipo/personalizables', getSubcategoriasPersonalizables);

// POST /api/subcategoria-cargo/:tipo - Crear nueva subcategoría personalizable
router.post('/:tipo', createSubcategoria);

// PUT /api/subcategoria-cargo/:id - Actualizar subcategoría
router.put('/:id', updateSubcategoria);

// PUT /api/subcategoria-cargo/:id/toggle - Activar/desactivar
router.put('/:id/toggle', toggleSubcategoria);

// DELETE /api/subcategoria-cargo/:id - Eliminar subcategoría personalizable
router.delete('/:id', deleteSubcategoria);

module.exports = router;
