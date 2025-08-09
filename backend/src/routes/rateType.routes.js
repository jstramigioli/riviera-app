const express = require('express');
const router = express.Router();

// NOTA: Las rutas de rateType han sido deshabilitadas porque el modelo RateType
// fue eliminado durante la reestructuración del sistema de tarifas.
// El nuevo sistema usa season_blocks, season_prices, service_types y season_service_adjustments.

// router.get('/:hotelId', rateTypeController.getRateTypes);
// router.post('/:hotelId', rateTypeController.createRateType);
// router.put('/:id', rateTypeController.updateRateType);
// router.delete('/:id', rateTypeController.deleteRateType);
// router.put('/:hotelId/reorder', rateTypeController.reorderRateTypes);

// Ruta temporal para evitar errores
router.get('*', (req, res) => {
  res.json({ 
    data: [], 
    errors: ['El sistema de rateType ha sido reemplazado por el nuevo sistema de tarifas'] 
  });
});

module.exports = router; 