/**
 * PROMO y FREE_NIGHTS viven en capa RATE (Consulta / cotización).
 * DESCUENTO (p.ej. efectivo) queda en SETTLEMENT salvo noches gratis.
 * Evita guardar % automático sin condiciones como SETTLEMENT
 * y que no aparezca en el preview RATE de Consulta.
 */
function resolveLayerAndBenefitBase({ kind, benefitType, layer, benefitBase }) {
  const kindNorm = String(kind || 'DESCUENTO').toUpperCase();
  const benefitNorm = String(benefitType || 'PERCENT').toUpperCase();
  const isFreeNights = benefitNorm === 'FREE_NIGHTS';
  const isRate = isFreeNights || kindNorm === 'PROMO';
  if (isRate) {
    return {
      layer: 'RATE',
      benefitBase: String(benefitBase || 'RATE_NIGHT').toUpperCase() === 'LODGING_TOTAL'
        ? 'LODGING_TOTAL'
        : 'RATE_NIGHT'
    };
  }
  return {
    layer: String(layer || 'SETTLEMENT').toUpperCase() === 'RATE' ? 'RATE' : 'SETTLEMENT',
    benefitBase: String(benefitBase || 'DEBT_CANCELLED').toUpperCase()
  };
}

module.exports = { resolveLayerAndBenefitBase };
