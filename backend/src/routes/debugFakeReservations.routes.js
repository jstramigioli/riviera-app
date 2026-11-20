const express = require('express');
const {
  meta,
  preview,
  generate,
  removeBatch,
  removeAll
} = require('../controllers/debugFakeReservations.controller');

const router = express.Router();

router.get('/meta', meta);
router.post('/preview', preview);
router.post('/', generate);
router.delete('/:batchId', removeBatch);
router.delete('/', removeAll);

module.exports = router;
