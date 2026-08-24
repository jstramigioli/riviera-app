const express = require('express');
const router = express.Router();
const { schemaUnavailable } = require('../middlewares/schemaUnavailable');

router.all('*', schemaUnavailable('OperationalPeriod'));

module.exports = router;
