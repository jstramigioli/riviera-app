/**
 * Dinero recibido + vuelto en cobros en efectivo.
 * Reusa Cobro existente: dineroRecibido (moneda del cobro) + vueltoARS (siempre ARS).
 * El vuelto NO es una devolución (cobroOrigen).
 */

const { roundMoney, toNumber } = require('./paymentDiscount');

function isEfectivo(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'efectivo';
}

function amountToArs(amount, moneda, tipoCambio) {
  const n = Math.abs(toNumber(amount));
  if (!(n > 0)) return 0;
  if (String(moneda || 'ARS').toUpperCase() === 'USD') {
    const tc = toNumber(tipoCambio);
    if (!(tc > 0)) return 0;
    // Evitar perder centavos: redondear solo el producto final.
    return roundMoney(n * tc);
  }
  return roundMoney(n);
}

function arsToAmount(ars, moneda, tipoCambio) {
  const n = Math.abs(toNumber(ars));
  if (!(n > 0)) return 0;
  if (String(moneda || 'ARS').toUpperCase() === 'USD') {
    const tc = toNumber(tipoCambio);
    if (!(tc > 0)) return 0;
    return roundMoney(n / tc);
  }
  return roundMoney(n);
}

/** Vuelto máximo = recibido_ARS − ingresado_ARS (≥ 0). */
function maxVueltoARS({ dineroRecibido, moneda, tipoCambio, montoIngresadoARS }) {
  const recibidoARS = amountToArs(dineroRecibido, moneda, tipoCambio);
  const ingresadoARS = roundMoney(Math.abs(toNumber(montoIngresadoARS)));
  return roundMoney(Math.max(0, recibidoARS - ingresadoARS));
}

/** Sugerencia de vuelto = excedente (misma fórmula que el máximo). */
function suggestVueltoARS(params) {
  return maxVueltoARS(params);
}

/**
 * Resuelve tender de efectivo para persistir en Cobro.
 * - No efectivo / devolución: dineroRecibido = |monto|, vueltoARS = 0; monto intacto.
 * - Efectivo: vuelto siempre = excedente máx (ignora vuelto manual del body).
 *   Crédito = subir monto ingresado (no poner vuelto en 0).
 *
 * @returns {{ ok: true, dineroRecibido: number, vueltoARS: number, montoAbs: number, montoARSAbs: number, cajaIngreso: { moneda: string, monto: number }, cajaVueltoARS: number } | { ok: false, error: string }}
 */
function resolveCashTender({
  metodo,
  monto,
  moneda = 'ARS',
  tipoCambio = null,
  dineroRecibido: dineroRecibidoInput,
  // vuelto manual ignorado: siempre se fuerza el máximo (solo lectura en UI).
  vueltoARS: _vueltoInput,
  isDevolucion = false
} = {}) {
  const monedaFinal = String(moneda || 'ARS').toUpperCase();
  const montoRaw = Math.abs(toNumber(monto));
  if (!(montoRaw > 0)) {
    return { ok: false, error: 'El monto debe ser mayor a 0' };
  }
  // Redondeo final en ARS; el monto en divisa se redondea al persistir.
  const ingresadoARS = amountToArs(montoRaw, monedaFinal, tipoCambio);
  const montoAbsIngresado = roundMoney(montoRaw);
  if (monedaFinal === 'USD' && !(toNumber(tipoCambio) > 0)) {
    return { ok: false, error: 'Para cobros en USD, el tipo de cambio es requerido' };
  }
  if (monedaFinal === 'USD' && !(ingresadoARS > 0)) {
    return { ok: false, error: 'No se pudo calcular el equivalente ARS del monto' };
  }

  if (!isEfectivo(metodo) || isDevolucion) {
    return {
      ok: true,
      dineroRecibido: montoAbsIngresado,
      vueltoARS: 0,
      montoAbs: montoAbsIngresado,
      montoARSAbs: ingresadoARS || montoAbsIngresado,
      cajaIngreso: { moneda: monedaFinal, monto: montoAbsIngresado },
      cajaVueltoARS: 0,
      excedenteACredito: false
    };
  }

  const hasExplicitRecibido =
    dineroRecibidoInput != null && String(dineroRecibidoInput).trim() !== '';
  const dineroRecibido = hasExplicitRecibido
    ? roundMoney(Math.abs(toNumber(dineroRecibidoInput)))
    : montoAbsIngresado;

  if (!(dineroRecibido > 0)) {
    return { ok: false, error: 'El dinero recibido debe ser mayor a 0' };
  }

  const vueltoARS = maxVueltoARS({
    dineroRecibido,
    moneda: monedaFinal,
    tipoCambio,
    montoIngresadoARS: ingresadoARS
  });

  return {
    ok: true,
    dineroRecibido,
    vueltoARS,
    montoAbs: montoAbsIngresado,
    montoARSAbs: ingresadoARS,
    cajaIngreso: { moneda: monedaFinal, monto: dineroRecibido },
    cajaVueltoARS: vueltoARS,
    excedenteACredito: false
  };
}

/** Defaults compatibles para históricos / lectura. */
function readCashTenderFields(cobro) {
  if (!cobro) {
    return { dineroRecibido: 0, vueltoARS: 0 };
  }
  const montoAbs = roundMoney(Math.abs(toNumber(cobro.monto)));
  const dineroRecibido =
    cobro.dineroRecibido != null
      ? roundMoney(Math.abs(toNumber(cobro.dineroRecibido)))
      : montoAbs;
  const vueltoARS =
    cobro.vueltoARS != null ? roundMoney(Math.max(0, toNumber(cobro.vueltoARS))) : 0;
  return { dineroRecibido, vueltoARS };
}

module.exports = {
  isEfectivo,
  amountToArs,
  arsToAmount,
  maxVueltoARS,
  suggestVueltoARS,
  resolveCashTender,
  readCashTenderFields
};
