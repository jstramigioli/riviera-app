const express = require('express');
const router = express.Router();
const {
  getAllQueries,
  getQueryById,
  createQuery,
  createMultiSegmentQuery,
  updateMultiSegmentQuery,
  updateQuery,
  deleteQuery,
  convertQueryToReservation,
  addGuestToQuery,
  updateQueryGuest,
  deleteQueryGuest,
  getQueryByClient
} = require('../controllers/query.controller');

// Rutas principales de consultas
router.get('/', getAllQueries);
router.get('/client/:clientId', getQueryByClient);
router.get('/:id', getQueryById);
router.post('/', createQuery);
router.post('/multi-segment', createMultiSegmentQuery);
router.put('/multi-segment/:queryGroupId', updateMultiSegmentQuery);
router.delete('/multi-segment/:queryGroupId', async (req, res) => {
  try {
    const { queryGroupId } = req.params;
    
    // Eliminar todas las queries del grupo
    const deletedQueries = await require('../utils/prisma').query.deleteMany({
      where: { queryGroupId }
    });
    
    // Eliminar el QueryGroup
    await require('../utils/prisma').queryGroup.delete({
      where: { id: queryGroupId }
    });
    
    res.json({ 
      message: 'Grupo de consultas eliminado exitosamente',
      deletedCount: deletedQueries.count
    });
  } catch (error) {
    console.error('Error al eliminar grupo de consultas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
router.put('/:id', updateQuery);
router.delete('/:id', deleteQuery);

// Ruta para convertir consulta a reserva
router.post('/:id/convert-to-reservation', convertQueryToReservation);

// Rutas para huéspedes de consultas
router.post('/:id/guests', addGuestToQuery);
router.put('/:id/guests/:guestId', updateQueryGuest);
router.delete('/guests/:guestId', deleteQueryGuest);

module.exports = router; 