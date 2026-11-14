/**
 * Preview de promo RATE automática para una habitación en el listado de Consulta.
 */
import { previewPromotion } from '../services/api';
import {
  flattenPreviewAppliedRules,
  mergeNightsWithPreview,
  nightPriceFromRate
} from './reservationConfirmationQuote';

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/**
 * @returns {Promise<{
 *   originalARS: number,
 *   finalARS: number,
 *   discountARS: number,
 *   promoLabel: string|null,
 *   hasPromo: boolean
 * }|null>}
 */
export async function previewRoomRatePromo({
  checkIn,
  checkOut,
  roomTypeId,
  serviceTypeId,
  rates = [],
  totalAmount = 0
} = {}) {
  if (!checkIn || !checkOut || !roomTypeId || !serviceTypeId) return null;

  const nights = (rates || []).map((rate, nightIndex) => {
    const date = rate.dateString || rate.date || null;
    const price = nightPriceFromRate(rate);
    return {
      nightIndex,
      date,
      originalARS: price
    };
  });

  const originalARS = money(
    nights.reduce((sum, n) => sum + n.originalARS, 0) || totalAmount || 0
  );
  if (!nights.length || originalARS <= 0) {
    return {
      originalARS,
      finalARS: originalARS,
      discountARS: 0,
      promoLabel: null,
      hasPromo: false
    };
  }

  try {
    const preview = await previewPromotion({
      layer: 'RATE',
      checkIn,
      checkOut,
      nights: nights.length,
      roomTypeId,
      serviceTypeId,
      nightPrices: nights.map((n) => n.originalARS),
      hotelId: 'default-hotel',
      applySuggestedDefaults: true
    });

    const merged = mergeNightsWithPreview(nights, preview);
    const discountARS = money(merged.reduce((sum, n) => sum + (n.discountARS || 0), 0));
    const finalARS = money(Math.max(0, originalARS - discountARS));
    const promos = flattenPreviewAppliedRules(preview);
    const promoLabel =
      promos.length > 0
        ? promos.map((p) => p.label).filter(Boolean).join(' · ')
        : null;

    return {
      originalARS,
      finalARS,
      discountARS,
      promoLabel,
      hasPromo: discountARS > 0 && Boolean(promoLabel)
    };
  } catch {
    return {
      originalARS,
      finalARS: originalARS,
      discountARS: 0,
      promoLabel: null,
      hasPromo: false
    };
  }
}
