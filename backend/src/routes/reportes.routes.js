const express = require('express');
const { getVentasGastronomia } = require('../controllers/reportes.controller');

const router = express.Router();

router.get('/ventas-gastronomia', getVentasGastronomia);

module.exports = router;
