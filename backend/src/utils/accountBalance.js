/**
 * Saldo de Account: misma fórmula que reservationBalance (Σ cargos − Σ pagos montoARS).
 */

const {
  calculateReservationBalance,
  sumCargos,
  sumPagos,
  EXCLUDED_RESERVATION_STATUSES,
  isReservationIncludedInClientBalance
} = require('./reservationBalance');

/** Alias semántico: balance de un folio Account. */
function calculateAccountBalance(cargos = [], pagos = []) {
  return calculateReservationBalance(cargos, pagos);
}

/**
 * Agrega saldos de accounts del cliente.
 * - RESERVATION: excluye canceladas / no-show (misma regla histórica).
 * - EXTERNAL: siempre suma (no tienen status de reserva).
 */
function aggregateAccountsBalance(accounts = []) {
  return accounts.reduce(
    (acc, account) => {
      if (account.kind === 'RESERVATION') {
        const reservation = account.reservation || { status: account.reservationStatus };
        if (!isReservationIncludedInClientBalance(reservation)) {
          return acc;
        }
      }

      const { totalCargos, totalPagos, saldo, estadoPago } = calculateAccountBalance(
        account.cargos || [],
        account.pagos || []
      );

      acc.totalCharges += totalCargos;
      acc.totalPayments += totalPagos;
      acc.balance += saldo;
      acc.accountCount += 1;
      if (account.kind === 'RESERVATION' && (account.reservationId || account.reservation?.id)) {
        acc.reservationCount += 1;
      }
      acc.accounts.push({
        accountId: account.id,
        kind: account.kind,
        reservationId: account.reservationId || account.reservation?.id || null,
        status: account.status,
        label: account.label || null,
        totalCargos,
        totalPagos,
        saldo,
        estadoPago
      });
      // Compat: filas tipo reserva para UI existente
      if (account.kind === 'RESERVATION' && (account.reservationId || account.reservation?.id)) {
        acc.reservations.push({
          reservationId: account.reservationId || account.reservation.id,
          status: account.reservation?.status || account.reservationStatus,
          totalCargos,
          totalPagos,
          saldo
        });
      }
      return acc;
    },
    {
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
      accountCount: 0,
      reservationCount: 0,
      accounts: [],
      reservations: []
    }
  );
}

module.exports = {
  calculateAccountBalance,
  aggregateAccountsBalance,
  sumCargos,
  sumPagos,
  EXCLUDED_RESERVATION_STATUSES,
  isReservationIncludedInClientBalance
};
