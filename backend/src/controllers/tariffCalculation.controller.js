/**
 * Legacy: este controller usaba seasonServiceAdjustments / isActive (schema obsoleto).
 * Path canónico: SeasonBlock + canonicalPricingService.
 */

const GONE = {
  data: null,
  errors: [
    'API legacy de tariff-calculations desactivada. Usá SeasonBlock / calculated-prices o calculated-rates (motor canónico).'
  ],
  deprecated: true,
  canonical: {
    adminPreview: 'GET /api/season-blocks/:id/calculated-prices',
    quotation: 'GET /api/dynamic-pricing/calculated-rates/:hotelId/:roomTypeId'
  }
};

const gone = async (_req, res) => {
  res.status(410).json(GONE);
};

exports.calculateSeasonBlockTariffs = gone;
exports.getTariffsForDate = gone;
exports.getPricesByDate = gone;
exports.compareTariffsBetweenBlocks = gone;
