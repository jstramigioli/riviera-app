/**
 * Helpers de Account (folio financiero).
 * Dual-write: Account es la FK canónica; reservaId se mantiene en cuentas RESERVATION.
 */

const ACCOUNT_KIND = {
  RESERVATION: 'RESERVATION',
  EXTERNAL: 'EXTERNAL'
};

const ACCOUNT_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
};

/**
 * Asegura Account 1:1 para una reserva (idempotente).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
async function ensureReservationAccount(db, reservationId, clientId = null) {
  const id = parseInt(reservationId, 10);
  if (!Number.isFinite(id)) {
    throw new Error('reservationId inválido para Account');
  }

  const existing = await db.account.findUnique({
    where: { reservationId: id }
  });
  if (existing) {
    if (
      clientId != null &&
      existing.clientId == null &&
      Number.isFinite(parseInt(clientId, 10))
    ) {
      return db.account.update({
        where: { id: existing.id },
        data: { clientId: parseInt(clientId, 10) }
      });
    }
    return existing;
  }

  let resolvedClientId =
    clientId != null && Number.isFinite(parseInt(clientId, 10))
      ? parseInt(clientId, 10)
      : null;
  if (resolvedClientId == null) {
    const reservation = await db.reservation.findUnique({
      where: { id },
      select: { mainClientId: true }
    });
    resolvedClientId = reservation?.mainClientId ?? null;
  }

  return db.account.create({
    data: {
      kind: ACCOUNT_KIND.RESERVATION,
      reservationId: id,
      clientId: resolvedClientId,
      label: `Reserva #${id}`,
      status: ACCOUNT_STATUS.OPEN
    }
  });
}

/**
 * Resuelve Account por reservationId (crea si falta — dual-write / legacy).
 */
async function resolveAccountForReservation(db, reservationId) {
  return ensureReservationAccount(db, reservationId);
}

/**
 * Payload dual-write para Cargo/Pago de una reserva.
 */
function dualWriteReservationRefs(account, reservationId) {
  return {
    accountId: account.id,
    reservaId: parseInt(reservationId, 10)
  };
}

/**
 * Payload para Cargo/Pago de cuenta externa (sin reserva).
 */
function dualWriteExternalRefs(account) {
  return {
    accountId: account.id,
    reservaId: null
  };
}

/**
 * Crea Account EXTERNAL (label alcanza; clientId opcional).
 */
async function createExternalAccount(db, { label, clientId = null, notes = null } = {}) {
  const trimmed = label != null ? String(label).trim() : '';
  if (!trimmed) {
    throw new Error('label es requerido para cuenta externa');
  }
  return db.account.create({
    data: {
      kind: ACCOUNT_KIND.EXTERNAL,
      reservationId: null,
      clientId:
        clientId != null && Number.isFinite(parseInt(clientId, 10))
          ? parseInt(clientId, 10)
          : null,
      label: trimmed,
      notes: notes != null ? String(notes).trim() || null : null,
      status: ACCOUNT_STATUS.OPEN
    }
  });
}

/**
 * Actualiza status OPEN/CLOSED según saldo (OPEN mientras saldo pendiente ≠ 0).
 */
async function syncAccountStatusFromBalance(db, accountId, saldo) {
  const next = Number(saldo) === 0 ? ACCOUNT_STATUS.CLOSED : ACCOUNT_STATUS.OPEN;
  return db.account.update({
    where: { id: parseInt(accountId, 10) },
    data: { status: next }
  });
}

/**
 * Conteo financiero de un Account (para warning al borrar reserva).
 */
async function getAccountFinancialCounts(db, accountId) {
  const id = parseInt(accountId, 10);
  const [cargos, pagos] = await Promise.all([
    db.cargo.count({ where: { accountId: id } }),
    db.pago.count({ where: { accountId: id } })
  ]);
  return { cargos, pagos, hasFinancials: cargos > 0 || pagos > 0 };
}

module.exports = {
  ACCOUNT_KIND,
  ACCOUNT_STATUS,
  ensureReservationAccount,
  resolveAccountForReservation,
  dualWriteReservationRefs,
  dualWriteExternalRefs,
  createExternalAccount,
  syncAccountStatusFromBalance,
  getAccountFinancialCounts
};
