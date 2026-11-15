const express = require('express');
const {
  listNotifications,
  syncNotifications,
  markRead,
  markUnread,
  resolveNotification,
  unresolveNotification
} = require('../controllers/notification.controller');

const router = express.Router();

router.get('/', listNotifications);
router.post('/sync', syncNotifications);
router.post('/:id/read', markRead);
router.delete('/:id/read', markUnread);
router.post('/:id/resolve', resolveNotification);
router.post('/:id/unresolve', unresolveNotification);

module.exports = router;
