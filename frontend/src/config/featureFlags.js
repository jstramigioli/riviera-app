/**
 * Feature flags del MVP operativo.
 * Deshabilitar tarifas automáticas / precios inteligentes / SeasonBlocks en UI
 * sin borrar el código de esas features.
 */
export const FEATURE_FLAGS = {
  /** Cotización automática vía SeasonBlock / getCalculatedRates */
  AUTO_RATES: false,
  /** Pantallas y nav de Tarifas / bloques de temporada */
  DYNAMIC_PRICING_UI: false,
  /** Precios inteligentes */
  SMART_PRICING_UI: false,
  /** Validar cierre del hotel con bloques de temporada (requiere tarifas auto) */
  SEASON_BLOCK_AVAILABILITY: false,
  /** Flujo de reserva con monto/tarifa ingresada a mano */
  MANUAL_RATES: true,
};

export function isFeatureEnabled(flag) {
  return Boolean(FEATURE_FLAGS[flag]);
}

export default FEATURE_FLAGS;
