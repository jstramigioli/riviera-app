const express = require('express');
const {
  login,
  logout,
  me,
  listUsers,
  listRoles,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/auth.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

router.get('/roles', requireAuth, requirePermission('users'), listRoles);
router.get('/users', requireAuth, requirePermission('users'), listUsers);
router.post('/users', requireAuth, requirePermission('users'), createUser);
router.put('/users/:id', requireAuth, requirePermission('users'), updateUser);
router.delete('/users/:id', requireAuth, requirePermission('users'), deleteUser);

module.exports = router;
