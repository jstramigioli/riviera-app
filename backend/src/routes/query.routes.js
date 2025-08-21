const express = require('express');
const router = express.Router();
const {
  getAllQueries,
  getQueryById,
  createQuery,
  updateQuery,
  deleteQuery,
  convertQueryToReservation,
  addGuestToQuery,
  updateQueryGuest,
  deleteQueryGuest
} = require('../controllers/query.controller');

// Rutas principales de consultas
router.get('/', getAllQueries);
router.get('/:id', getQueryById);
router.post('/', createQuery);
router.put('/:id', updateQuery);
router.delete('/:id', deleteQuery);

// Ruta para convertir consulta a reserva
router.post('/:id/convert-to-reservation', convertQueryToReservation);

// Rutas para huéspedes de consultas
router.post('/:id/guests', addGuestToQuery);
router.put('/:id/guests/:guestId', updateQueryGuest);
router.delete('/guests/:guestId', deleteQueryGuest);

module.exports = router; 