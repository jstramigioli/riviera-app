/**
 * Reparte un total de estadía en N noches: promedio (floor a centavos)
 * y el resto de centavos a las primeras noches para que la suma sea exacta.
 */

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * @param {number} totalARS
 * @param {number} nightCount
 * @returns {number[]} montos por noche (suma === total redondeado a centavos)
 */
export function distributeStayTotal(totalARS, nightCount) {
  const n = Math.max(0, Math.floor(Number(nightCount) || 0));
  if (n <= 0) return [];

  const totalCents = Math.round(money(totalARS) * 100);
  if (totalCents < 0) {
    return Array.from({ length: n }, () => 0);
  }

  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    out.push((base + extra) / 100);
  }
  return out;
}

/**
 * Aplica montos repartidos a un plan de noches (orden estadía).
 * @param {Array<{ date?: string, dateLabel?: string, originalARS?: number }>} nights
 * @param {number} totalARS
 */
export function applyDistributedTotalsToNights(nights = [], totalARS) {
  const list = Array.isArray(nights) ? nights : [];
  const amounts = distributeStayTotal(totalARS, list.length);
  return list.map((night, i) => {
    const amount = amounts[i] ?? 0;
    return {
      ...night,
      originalARS: amount,
      discountARS: 0,
      finalARS: amount,
      freeNight: false,
      promoLabel: null,
      manualOverride: true
    };
  });
}
