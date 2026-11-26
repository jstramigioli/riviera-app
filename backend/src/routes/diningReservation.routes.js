const express = require('express');
const router = express.Router();
const controller = require('../controllers/diningReservation.controller');

router.get('/agenda', controller.getAgenda);
router.get('/', controller.listDiningReservations);
router.get('/:id', controller.getDiningReservation);
router.post('/', controller.createDiningReservation);
router.patch('/:id', controller.updateDiningReservation);
router.post('/:id/cancel', controller.cancelDiningReservation);

module.exports = router;
