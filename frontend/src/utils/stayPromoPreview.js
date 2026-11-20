/**
 * Preview RATE a nivel estadía completa (todos los segmentos = un tramo).
 * Evita duplicar FREE_NIGHTS / condiciones por segmento.
 */

function civilKey(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/**
 * Aplana segmentos cotizados en una sola estadía ordenada.
 * @returns {{
 *   nightPrices: number[],
 *   nights: Array, // noches con segmentIndex + localNightIndex
 *   checkIn: string|null,
 *   checkOut: string|null,
 *   roomTypeId: *,
 *   serviceTypeId: *,
 *   subtotal: number,
 *   offsets: Array<{ segmentIndex: number, start: number, end: number, subtotal: number }>
 * }}
 */
export function buildStayNightPlan(segmentNightGroups = []) {
  const nights = [];
  const nightPrices = [];
  const offsets = [];
  let checkIn = null;
  let checkOut = null;
  let roomTypeId = null;
  let serviceTypeId = null;
  let subtotal = 0;

  for (const seg of segmentNightGroups || []) {
    if (!seg) continue;
    const start = nightPrices.length;
    const segNights = Array.isArray(seg.nights) ? seg.nights : [];
    for (let local = 0; local < segNights.length; local++) {
      const night = segNights[local];
      nights.push({
        ...night,
        segmentIndex: seg.segmentIndex,
        localNightIndex: local,
        nightIndex: nightPrices.length
      });
      nightPrices.push(Number(night.originalARS) || 0);
    }
    const end = nightPrices.length;
    offsets.push({
      segmentIndex: seg.segmentIndex,
      start,
      end,
      subtotal: Number(seg.subtotal) || 0
    });
    subtotal += Number(seg.subtotal) || 0;

    const cin = civilKey(seg.checkIn);
    const cout = civilKey(seg.checkOut);
    if (cin && (!checkIn || cin < checkIn)) checkIn = cin;
    if (cout && (!checkOut || cout > checkOut)) checkOut = cout;
    if (roomTypeId == null && seg.roomTypeId != null) roomTypeId = seg.roomTypeId;
    if (serviceTypeId == null && seg.serviceTypeId != null) {
      serviceTypeId = seg.serviceTypeId;
    }
  }

  return {
    nightPrices,
    nights,
    checkIn,
    checkOut,
    roomTypeId,
    serviceTypeId,
    subtotal,
    offsets
  };
}
