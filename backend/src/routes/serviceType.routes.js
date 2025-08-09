const express = require('express');
const serviceTypeController = require('../controllers/serviceType.controller');

const router = express.Router();

// GET /api/service-types - Listar todos los tipos de servicio
router.get('/', serviceTypeController.getAllServiceTypes);

// PUT /api/service-types/order - Actualizar el orden de los tipos de servicio
router.put('/order', serviceTypeController.updateServiceTypesOrder);

// GET /api/service-types/:id - Obtener un tipo de servicio específico
router.get('/:id', serviceTypeController.getServiceTypeById);

// POST /api/service-types - Crear un nuevo tipo de servicio
router.post('/', serviceTypeController.createServiceType);

// PUT /api/service-types/:id - Actualizar un tipo de servicio
router.put('/:id', serviceTypeController.updateServiceType);

// DELETE /api/service-types/:id - Eliminar un tipo de servicio
router.delete('/:id', serviceTypeController.deleteServiceType);

module.exports = router; 