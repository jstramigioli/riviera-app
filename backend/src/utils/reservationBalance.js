/**
 * Fuente única de saldo de una reserva/Account:
 * cargos − pagos (montoARS) − descuentos aplicados (montoARS).
 */

const EXCLUDED_RESERVATION_STATUSES = new Set([
  'CANCELADA',
  'NO_PRESENTADA',
  'cancelled',
  'no_show',
]);

function toAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function sumCargos(cargos = []) {
  return cargos.reduce((sum, cargo) => sum + toAmount(cargo.monto), 0);
}

function sumPagos(pagos = []) {
  return pagos.reduce((sum, pago) => sum + toAmount(pago.montoARS), 0);
}

/** Suma créditos de descuento (filas positivas y reversiones negativas). */
function sumDescuentos(discounts = []) {
  return discounts.reduce((sum, d) => sum + toAmount(d.montoARS), 0);
}

/**
 * @param {Array} cargos
 * @param {Array} pagos
 * @param {Array} discounts DiscountApplication[] (todas las filas; reversión = monto negativo)
 */
function calculateReservationBalance(cargos = [], pagos = [], discounts = []) {
  const totalCargos = sumCargos(cargos);
  const totalPagos = sumPagos(pagos);
  const totalDescuentos = sumDescuentos(discounts);
  const saldo = totalCargos - totalPagos - totalDescuentos;

  return {
    totalCargos,
    totalPagos,
    totalDescuentos,
    saldo,
    estadoPago: saldo > 0 ? 'PENDIENTE' : saldo < 0 ? 'A_FAVOR' : 'PAGADO',
  };
}

function isReservationIncludedInClientBalance(reservation) {
  if (!reservation) return false;
  return !EXCLUDED_RESERVATION_STATUSES.has(reservation.status);
}

function aggregateReservationsBalance(reservations = []) {
  return reservations
    .filter(isReservationIncludedInClientBalance)
    .reduce(
      (acc, reservation) => {
        const { totalCargos, totalPagos, totalDescuentos, saldo } = calculateReservationBalance(
          reservation.cargos || [],
          reservation.pagos || [],
          reservation.discountApplications || reservation.descuentos || []
        );
        acc.totalCharges += totalCargos;
        acc.totalPayments += totalPagos;
        acc.totalDiscounts += totalDescuentos;
        acc.balance += saldo;
        acc.reservationCount += 1;
        acc.reservations.push({
          reservationId: reservation.id,
          status: reservation.status,
          totalCargos,
          totalPagos,
          totalDescuentos,
          saldo,
        });
        return acc;
      },
      {
        totalCharges: 0,
        totalPayments: 0,
        totalDiscounts: 0,
        balance: 0,
        reservationCount: 0,
        reservations: [],
      }
    );
}

/** Alias: misma fórmula aplicada a un Account (cargos/pagos/descuentos del folio). */
function calculateAccountBalance(cargos = [], pagos = [], discounts = []) {
  return calculateReservationBalance(cargos, pagos, discounts);
}

module.exports = {
  EXCLUDED_RESERVATION_STATUSES,
  calculateReservationBalance,
  calculateAccountBalance,
  aggregateReservationsBalance,
  isReservationIncludedInClientBalance,
  sumCargos,
  sumPagos,
  sumDescuentos,
};
