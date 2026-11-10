const express = require('express');
const { login, logout, me, listUsers } = require('../controllers/auth.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.get('/users', requireAuth, requirePermission('users'), listUsers);

module.exports = router;
