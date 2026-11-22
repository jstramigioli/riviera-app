const express = require('express');
const multer = require('multer');
const clientController = require('../controllers/client.controller');
const { validateClient } = require('../middlewares/validation');

const router = express.Router();

const uploadDocumentPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

// GET /api/clients - Listar todos los clientes
router.get('/', clientController.getAllClients);

// POST /api/clients - Crear un nuevo cliente
router.post('/', validateClient, clientController.createClient);

// Foto de DNI/documento (filesystem; sin columna Prisma)
router.get('/:id/document-photo', clientController.getClientDocumentPhoto);
router.get('/:id/document-photo/file', clientController.downloadClientDocumentPhoto);
router.post(
  '/:id/document-photo',
  uploadDocumentPhoto.single('file'),
  clientController.uploadClientDocumentPhoto
);
router.delete('/:id/document-photo', clientController.deleteClientDocumentPhoto);

// Calcular balance de un cliente
router.get('/:id/balance', clientController.getClientBalance);

// Cobro con imputaciones múltiples a reservas del cliente
const reservationCobrosController = require('../controllers/reservationCobros.controller');
router.post('/:id/cobros', reservationCobrosController.createClientMultiCobro);

// Datos de facturación (aparte del perfil del cliente)
router.get('/:id/billing-profile', clientController.getClientBillingProfile);
router.put('/:id/billing-profile', clientController.upsertClientBillingProfile);

// GET /api/clients/:id - Obtener un cliente específico
router.get('/:id', clientController.getClientById);

// PUT /api/clients/:id - Actualizar un cliente
router.put('/:id', validateClient, clientController.updateClient);

// DELETE /api/clients/:id - Eliminar un cliente
router.delete('/:id', clientController.deleteClient);

module.exports = router; 