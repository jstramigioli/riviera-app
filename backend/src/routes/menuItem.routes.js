const express = require('express');
const { requirePermission } = require('../middlewares/auth');
const {
  listCategories,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleMenuItem,
  deleteMenuItem
} = require('../controllers/menuItem.controller');

const router = express.Router();

// Lectura: cualquier usuario autenticado (comanda POS en recepción)
router.get('/categories', listCategories);
router.get('/', listMenuItems);

// Escritura: solo settings (Configuración)
router.post('/', requirePermission('settings'), createMenuItem);
router.put('/:id', requirePermission('settings'), updateMenuItem);
router.put('/:id/toggle', requirePermission('settings'), toggleMenuItem);
router.delete('/:id', requirePermission('settings'), deleteMenuItem);

module.exports = router;
