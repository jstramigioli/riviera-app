const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');

// Listar todos los clientes
router.get('/', clientController.getAllClients);

// Crear un cliente
router.post('/', clientController.createClient);

// Actualizar un cliente
router.put('/:id', clientController.updateClient);

// Calcular balance de un cliente
router.get('/:id/balance', clientController.getClientBalance);

module.exports = router; 