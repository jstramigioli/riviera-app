/**
 * Fuente única de saldo de una reserva/Account:
 * cargos − cobros (montoARS) − descuentos aplicados (montoARS).
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

function sumCobros(cobros = []) {
  return cobros.reduce((sum, cobro) => sum + toAmount(cobro.montoARS), 0);
}

/** Suma créditos de descuento (filas positivas y reversiones negativas). */
function sumDescuentos(discounts = []) {
  return discounts.reduce((sum, d) => sum + toAmount(d.montoARS), 0);
}

/**
 * @param {Array} cargos
 * @param {Array} cobros
 * @param {Array} discounts DiscountApplication[] (todas las filas; reversión = monto negativo)
 */
function calculateReservationBalance(cargos = [], cobros = [], discounts = []) {
  const totalCargos = sumCargos(cargos);
  const totalCobros = sumCobros(cobros);
  const totalDescuentos = sumDescuentos(discounts);
  const saldo = totalCargos - totalCobros - totalDescuentos;

  return {
    totalCargos,
    totalCobros,
    totalDescuentos,
    saldo,
    estadoCobro: saldo > 0 ? 'PENDIENTE' : saldo < 0 ? 'A_FAVOR' : 'PAGADO',
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
        const { totalCargos, totalCobros, totalDescuentos, saldo } = calculateReservationBalance(
          reservation.cargos || [],
          reservation.cobros || [],
          reservation.discountApplications || reservation.descuentos || []
        );
        acc.totalCharges += totalCargos;
        acc.totalCobros += totalCobros;
        acc.totalDiscounts += totalDescuentos;
        acc.balance += saldo;
        acc.reservationCount += 1;
        acc.reservations.push({
          reservationId: reservation.id,
          status: reservation.status,
          totalCargos,
          totalCobros,
          totalDescuentos,
          saldo,
        });
        return acc;
      },
      {
        totalCharges: 0,
        totalCobros: 0,
        totalDiscounts: 0,
        balance: 0,
        reservationCount: 0,
        reservations: [],
      }
    );
}

/** Alias: misma fórmula aplicada a un Account (cargos/cobros/descuentos del folio). */
function calculateAccountBalance(cargos = [], cobros = [], discounts = []) {
  return calculateReservationBalance(cargos, cobros, discounts);
}

module.exports = {
  EXCLUDED_RESERVATION_STATUSES,
  calculateReservationBalance,
  calculateAccountBalance,
  aggregateReservationsBalance,
  isReservationIncludedInClientBalance,
  sumCargos,
  sumCobros,
  sumDescuentos,
};
