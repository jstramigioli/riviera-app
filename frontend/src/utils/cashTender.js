/**
 * Dinero recibido + vuelto (efectivo). Mirror del util de backend.
 */

import { roundMoney } from './paymentDiscount';

export function isEfectivo(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'efectivo';
}

export function amountToArs(amount, moneda, tipoCambio) {
  const n = Math.abs(Number(amount) || 0);
  if (!(n > 0)) return 0;
  if (String(moneda || 'ARS').toUpperCase() === 'USD') {
    const tc = parseFloat(tipoCambio) || 0;
    if (!(tc > 0)) return 0;
    return roundMoney(n * tc);
  }
  return roundMoney(n);
}

export function maxVueltoARS({ dineroRecibido, moneda, tipoCambio, montoIngresadoARS }) {
  const recibidoARS = amountToArs(dineroRecibido, moneda, tipoCambio);
  const ingresadoARS = roundMoney(Math.abs(Number(montoIngresadoARS) || 0));
  return roundMoney(Math.max(0, recibidoARS - ingresadoARS));
}

export function suggestVueltoARS(params) {
  return maxVueltoARS(params);
}

export function readCashTenderFields(cobro) {
  if (!cobro) return { dineroRecibido: 0, vueltoARS: 0 };
  const montoAbs = roundMoney(Math.abs(Number(cobro.monto) || 0));
  const dineroRecibido =
    cobro.dineroRecibido != null
      ? roundMoney(Math.abs(Number(cobro.dineroRecibido) || 0))
      : montoAbs;
  const vueltoARS =
    cobro.vueltoARS != null ? roundMoney(Math.max(0, Number(cobro.vueltoARS) || 0)) : 0;
  return { dineroRecibido, vueltoARS };
}
