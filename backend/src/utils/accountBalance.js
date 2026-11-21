/**
 * Saldo de Account: Σ cargos − Σ cobros.montoARS − Σ DiscountApplication.montoARS.
 */

const {
  calculateReservationBalance,
  sumCargos,
  sumCobros,
  sumDescuentos,
  EXCLUDED_RESERVATION_STATUSES,
  isReservationIncludedInClientBalance
} = require('./reservationBalance');

/** Alias semántico: balance de un folio Account. */
function calculateAccountBalance(cargos = [], cobros = [], discounts = []) {
  return calculateReservationBalance(cargos, cobros, discounts);
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

      const { totalCargos, totalCobros, totalDescuentos, saldo, estadoCobro } = calculateAccountBalance(
        account.cargos || [],
        account.cobros || [],
        account.discountApplications || account.descuentos || []
      );

      acc.totalCharges += totalCargos;
      acc.totalCobros += totalCobros;
      acc.totalDiscounts += totalDescuentos;
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
        totalCobros,
        totalDescuentos,
        saldo,
        estadoCobro
      });
      // Compat: filas tipo reserva para UI existente
      if (account.kind === 'RESERVATION' && (account.reservationId || account.reservation?.id)) {
        acc.reservations.push({
          reservationId: account.reservationId || account.reservation.id,
          status: account.reservation?.status || account.reservationStatus,
          totalCargos,
          totalCobros,
          totalDescuentos,
          saldo
        });
      }
      return acc;
    },
    {
      totalCharges: 0,
      totalCobros: 0,
      totalDiscounts: 0,
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
  sumCobros,
  sumDescuentos,
  EXCLUDED_RESERVATION_STATUSES,
  isReservationIncludedInClientBalance
};
