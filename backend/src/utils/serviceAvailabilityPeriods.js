/**
 * Períodos de disponibilidad de un servicio a lo largo de la estadía.
 *
 * Regla de producto: partir tramos solo cuando el servicio pedido deja de estar
 * disponible. NO partir por límites de bloque de temporada si al día siguiente
 * el mismo servicio sigue habilitado (evita el falso hueco 24–25 → solo alojamiento).
 *
 * Convención de salida: startDate/endDate como check-in / check-out (fin exclusivo),
 * alineado con segmentos de Consulta/reserva.
 */

const { civilFromDb, shiftIso } = require('./calendarDates');

function toCivil(value) {
  if (!value) return null;
  return civilFromDb(value);
}

/**
 * Fusiona períodos half-open [start, end) contiguos o solapados.
 * Contiguo: el siguiente empieza el mismo día que termina el anterior.
 *
 * @param {Array<{ startDate: string|Date, endDate: string|Date, blockName?: string }>} periods
 * @returns {Array<{ startDate: string, endDate: string, blockName?: string|null }>}
 */
function mergeContiguousServicePeriods(periods = []) {
  const normalized = (periods || [])
    .map((p) => {
      const startDate = toCivil(p.startDate);
      const endDate = toCivil(p.endDate);
      if (!startDate || !endDate || startDate >= endDate) return null;
      return {
        startDate,
        endDate,
        blockName: p.blockName || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));

  if (!normalized.length) return [];

  const merged = [{ ...normalized[0] }];
  for (let i = 1; i < normalized.length; i++) {
    const cur = normalized[i];
    const prev = merged[merged.length - 1];
    if (cur.startDate <= prev.endDate) {
      if (cur.endDate > prev.endDate) prev.endDate = cur.endDate;
      if (prev.blockName && cur.blockName && prev.blockName !== cur.blockName) {
        prev.blockName = `${prev.blockName} + ${cur.blockName}`;
      } else if (!prev.blockName && cur.blockName) {
        prev.blockName = cur.blockName;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Intersección estadía ∩ bloques con el servicio, en half-open [checkIn, checkOut).
 *
 * @param {{ start?: string|Date, end?: string|Date, checkIn?: string|Date, checkOut?: string|Date }} stay
 * @param {Array<{ startDate: Date|string, endDate: Date|string, name?: string, blockName?: string }>} blocksWithService
 */
function buildMergedAvailablePeriods(stay, blocksWithService = []) {
  const stayStart = toCivil(stay.checkIn || stay.start || stay.startDate);
  const stayEndExclusive = toCivil(stay.checkOut || stay.end || stay.endDate);
  if (!stayStart || !stayEndExclusive || stayStart >= stayEndExclusive) return [];

  const lastStayNight = shiftIso(stayEndExclusive, -1);
  const raw = [];

  for (const block of blocksWithService || []) {
    const blockStart = toCivil(block.startDate);
    const blockEndInclusive = toCivil(block.endDate);
    if (!blockStart || !blockEndInclusive) continue;

    const nightStart = blockStart > stayStart ? blockStart : stayStart;
    const nightEndInclusive =
      blockEndInclusive < lastStayNight ? blockEndInclusive : lastStayNight;

    if (nightStart <= nightEndInclusive) {
      raw.push({
        startDate: nightStart,
        // check-out exclusivo = día siguiente a la última noche cubierta
        endDate: shiftIso(nightEndInclusive, 1),
        blockName: block.name || block.blockName || null
      });
    }
  }

  return mergeContiguousServicePeriods(raw);
}

module.exports = {
  mergeContiguousServicePeriods,
  buildMergedAvailablePeriods
};
