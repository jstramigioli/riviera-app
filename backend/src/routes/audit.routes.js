const express = require('express');
const {
  listAuditLogs,
  getAuditLogById,
  listAuditEntities
} = require('../controllers/audit.controller');

const router = express.Router();

router.get('/meta/entities', listAuditEntities);
router.get('/', listAuditLogs);
router.get('/:id', getAuditLogById);

module.exports = router;
