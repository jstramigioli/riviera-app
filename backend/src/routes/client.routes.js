const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');

// Listar todos los clientes
router.get('/', clientController.getAllClients);

// Crear un cliente
router.post('/', clientController.createClient);

module.exports = router; 