/**
 * Fuente única de saldo de una reserva: cargos − pagos (montoARS).
 * Usada por resumen de reserva, listado de saldos y balance de cliente/huésped.
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

function calculateReservationBalance(cargos = [], pagos = []) {
  const totalCargos = sumCargos(cargos);
  const totalPagos = sumPagos(pagos);
  const saldo = totalCargos - totalPagos;

  return {
    totalCargos,
    totalPagos,
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
        const { totalCargos, totalPagos, saldo } = calculateReservationBalance(
          reservation.cargos || [],
          reservation.pagos || []
        );
        acc.totalCharges += totalCargos;
        acc.totalPayments += totalPagos;
        acc.balance += saldo;
        acc.reservationCount += 1;
        acc.reservations.push({
          reservationId: reservation.id,
          status: reservation.status,
          totalCargos,
          totalPagos,
          saldo,
        });
        return acc;
      },
      {
        totalCharges: 0,
        totalPayments: 0,
        balance: 0,
        reservationCount: 0,
        reservations: [],
      }
    );
}

/** Alias: misma fórmula aplicada a un Account (cargos/pagos del folio). */
function calculateAccountBalance(cargos = [], pagos = []) {
  return calculateReservationBalance(cargos, pagos);
}

module.exports = {
  EXCLUDED_RESERVATION_STATUSES,
  calculateReservationBalance,
  calculateAccountBalance,
  aggregateReservationsBalance,
  isReservationIncludedInClientBalance,
  sumCargos,
  sumPagos,
};
