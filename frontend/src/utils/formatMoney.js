/**
 * Formato de montos con código de moneda (ARS / USD / …).
 * Evita el símbolo `$` que confunde pesos con dólares.
 *
 * Ej.: formatMoney(1234.5) → "1.234,50 ARS"
 *      formatMoney(120, 'USD') → "120,00 USD"
 */

function toNumber(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCurrency(currency) {
  const code = String(currency || 'ARS').trim().toUpperCase();
  return code || 'ARS';
}

/**
 * @param {number|string|null|undefined} amount
 * @param {string} [currency='ARS']
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number, signed?: boolean }} [opts]
 * @returns {string}
 */
export function formatMoney(amount, currency = 'ARS', opts = {}) {
  const code = normalizeCurrency(currency);
  const n = toNumber(amount);
  const max =
    opts.maximumFractionDigits != null ? opts.maximumFractionDigits : 2;
  const min =
    opts.minimumFractionDigits != null
      ? opts.minimumFractionDigits
      : Math.min(2, max);
  const abs = Math.abs(n);
  const num = abs.toLocaleString('es-AR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max
  });
  const body = `${num} ${code}`;
  if (opts.signed && n < 0) return `−${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

/** Alias explícito para montos en pesos. */
export function formatMoneyArs(amount, opts) {
  return formatMoney(amount, 'ARS', opts);
}

/** Alias explícito para montos en dólares. */
export function formatMoneyUsd(amount, opts) {
  return formatMoney(amount, 'USD', opts);
}
