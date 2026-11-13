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
const {
  listGroups,
  createGroup,
  updateGroup,
  toggleGroup,
  deleteGroup,
  listSubgroups,
  createSubgroup,
  updateSubgroup,
  deleteSubgroup
} = require('../controllers/menuTaxonomy.controller');

const router = express.Router();

// Lectura: cualquier usuario autenticado (comanda POS en recepción)
router.get('/categories', listCategories);
router.get('/groups', listGroups);
router.get('/subgroups', listSubgroups);
router.get('/', listMenuItems);

// Escritura: solo settings (Configuración)
router.post('/groups', requirePermission('settings'), createGroup);
router.put('/groups/:id', requirePermission('settings'), updateGroup);
router.put('/groups/:id/toggle', requirePermission('settings'), toggleGroup);
router.delete('/groups/:id', requirePermission('settings'), deleteGroup);

router.post('/subgroups', requirePermission('settings'), createSubgroup);
router.put('/subgroups/:id', requirePermission('settings'), updateSubgroup);
router.delete('/subgroups/:id', requirePermission('settings'), deleteSubgroup);

router.post('/', requirePermission('settings'), createMenuItem);
router.put('/:id', requirePermission('settings'), updateMenuItem);
router.put('/:id/toggle', requirePermission('settings'), toggleMenuItem);
router.delete('/:id', requirePermission('settings'), deleteMenuItem);

module.exports = router;
