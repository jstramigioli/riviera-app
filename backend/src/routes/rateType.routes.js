const express = require('express');
const router = express.Router();
const { schemaUnavailable } = require('../middlewares/schemaUnavailable');

router.all('*', schemaUnavailable('RateType'));

module.exports = router;
