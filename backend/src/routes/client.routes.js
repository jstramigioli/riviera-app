const express = require('express');
const clientController = require('../controllers/client.controller');
const { validateClient } = require('../middlewares/validation');

const router = express.Router();

// GET /api/clients - Listar todos los clientes
router.get('/', clientController.getAllClients);

// GET /api/clients/:id - Obtener un cliente específico
router.get('/:id', clientController.getClientById);

// POST /api/clients - Crear un nuevo cliente
router.post('/', validateClient, clientController.createClient);

// PUT /api/clients/:id - Actualizar un cliente
router.put('/:id', validateClient, clientController.updateClient);

// DELETE /api/clients/:id - Eliminar un cliente
router.delete('/:id', clientController.deleteClient);

// Calcular balance de un cliente
router.get('/:id/balance', clientController.getClientBalance);

module.exports = router; 