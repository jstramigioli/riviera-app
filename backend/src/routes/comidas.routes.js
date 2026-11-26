const express = require('express');
const { getComidasDelDia } = require('../controllers/comidas.controller');

const router = express.Router();

router.get('/', getComidasDelDia);

module.exports = router;
