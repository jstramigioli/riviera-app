/**
 * Distribución de un Cobro (caja) en N CobroImputacion (crédito de folio).
 */

const { roundMoney, toNumber } = require('./paymentDiscount');

const MONEY_EPS = 0.009;

function assertFiniteMoney(value, label = 'monto') {
  const n = toNumber(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${label} inválido`);
    err.statusCode = 400;
    throw err;
  }
  return roundMoney(n);
}

/**
 * Valida que la suma de imputaciones (abs) coincida con |pagoMontoARS|.
 * @param {Array<{ accountId: number, reservaId?: number|null, montoARS: number, bonificacionARS?: number }>} rows
 * @param {number} pagoMontoARS signed
 */
function validateImputaciones(rows, pagoMontoARS, { bonificacionTotalARS = 0 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error('Se requiere al menos una imputación');
    err.statusCode = 400;
    throw err;
  }

  const pagoAbs = roundMoney(Math.abs(toNumber(pagoMontoARS)));
  const sign = toNumber(pagoMontoARS) < 0 ? -1 : 1;
  const seenAccounts = new Set();
  let sumAbs = 0;
  let sumBono = 0;

  const normalized = rows.map((row, index) => {
    const accountId = parseInt(row.accountId, 10);
    if (!Number.isFinite(accountId)) {
      const err = new Error(`imputaciones[${index}].accountId inválido`);
      err.statusCode = 400;
      throw err;
    }
    if (seenAccounts.has(accountId)) {
      const err = new Error(`Cuenta ${accountId} duplicada en imputaciones`);
      err.statusCode = 400;
      throw err;
    }
    seenAccounts.add(accountId);

    let monto = assertFiniteMoney(row.montoARS, `imputaciones[${index}].montoARS`);
    if (monto === 0) {
      const err = new Error(`imputaciones[${index}].montoARS no puede ser 0`);
      err.statusCode = 400;
      throw err;
    }
    // Forzar signo del cobro (devolución → negativos)
    if (sign < 0 && monto > 0) monto = -monto;
    if (sign > 0 && monto < 0) {
      const err = new Error(`imputaciones[${index}].montoARS no puede ser negativo en un cobro`);
      err.statusCode = 400;
      throw err;
    }

    const bonificacionARS = roundMoney(Math.max(0, toNumber(row.bonificacionARS || 0)));
    sumAbs = roundMoney(sumAbs + Math.abs(monto));
    sumBono = roundMoney(sumBono + bonificacionARS);

    return {
      accountId,
      reservaId:
        row.reservaId == null || row.reservaId === ''
          ? null
          : parseInt(row.reservaId, 10),
      montoARS: monto,
      bonificacionARS,
      ordenIndex: Number.isFinite(row.ordenIndex) ? Number(row.ordenIndex) : index
    };
  });

  if (sumAbs - pagoAbs > MONEY_EPS) {
    const err = new Error(
      `La suma imputada (${sumAbs.toFixed(2)}) supera el recibido (${pagoAbs.toFixed(2)} ARS)`
    );
    err.statusCode = 400;
    throw err;
  }
  if (pagoAbs - sumAbs > MONEY_EPS) {
    const err = new Error(
      `Queda pendiente de imputar ${(pagoAbs - sumAbs).toFixed(2)} ARS (recibido ${pagoAbs.toFixed(2)})`
    );
    err.statusCode = 400;
    throw err;
  }

  const bonoTotal = roundMoney(Math.max(0, toNumber(bonificacionTotalARS)));
  if (sumBono - bonoTotal > MONEY_EPS) {
    const err = new Error(
      `La bonificación imputada (${sumBono.toFixed(2)}) supera el bono total (${bonoTotal.toFixed(2)} ARS)`
    );
    err.statusCode = 400;
    throw err;
  }

  return normalized;
}

/**
 * Auto-distribuye |recibido| a cuentas ordenadas (más antigua primero).
 * `saldos` = deuda pendiente (>0 a pagar). No exige saldar todo el saldo.
 * Última fila absorbe centavos de redondeo.
 *
 * @param {number} recibidoARS abs
 * @param {Array<{ accountId: number, reservaId?: number|null, saldoPendiente: number, sortKey?: string|Date|number }>} targets
 */
function autoDistributeOldestFirst(recibidoARS, targets = []) {
  const total = roundMoney(Math.abs(toNumber(recibidoARS)));
  if (total <= 0 || !targets.length) return [];

  const ordered = [...targets].sort((a, b) => {
    const ka = a.sortKey instanceof Date ? a.sortKey.getTime() : a.sortKey ?? a.accountId;
    const kb = b.sortKey instanceof Date ? b.sortKey.getTime() : b.sortKey ?? b.accountId;
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a.accountId - b.accountId;
  });

  let remaining = total;
  const rows = [];
  for (let i = 0; i < ordered.length; i += 1) {
    if (remaining <= MONEY_EPS) break;
    const t = ordered[i];
    const debt = Math.max(0, roundMoney(toNumber(t.saldoPendiente)));
    if (debt <= MONEY_EPS) continue;
    const isLast = i === ordered.length - 1;
    let take = roundMoney(Math.min(debt, remaining));
    if (isLast) {
      // No volcar todo el restante si supera deuda; solo deuda.
      take = roundMoney(Math.min(debt, remaining));
    }
    if (take <= MONEY_EPS) continue;
    rows.push({
      accountId: t.accountId,
      reservaId: t.reservaId ?? null,
      montoARS: take,
      bonificacionARS: 0,
      ordenIndex: rows.length
    });
    remaining = roundMoney(remaining - take);
  }

  // Si quedó restante (saldos insuficientes), la spec permite no exigir cancelación total:
  // el sobrante debe imputarse explícitamente (caller) o rechazarse en validate.
  // Aquí devolvemos solo lo asignado a deudas; caller puede poner resto en última fila.
  if (remaining > MONEY_EPS && rows.length > 0) {
    const last = rows[rows.length - 1];
    last.montoARS = roundMoney(last.montoARS + remaining);
    remaining = 0;
  }

  return rows;
}

/**
 * Prorratea bonificación total proporcional a |montoARS| de cada fila; última absorbe redondeo.
 */
function distributeBonificacion(rows, bonificacionTotalARS) {
  const bono = roundMoney(Math.max(0, toNumber(bonificacionTotalARS)));
  if (bono <= 0 || !rows.length) {
    return rows.map((r) => ({ ...r, bonificacionARS: 0 }));
  }
  const absSum = rows.reduce((s, r) => s + Math.abs(toNumber(r.montoARS)), 0);
  if (absSum <= 0) {
    return rows.map((r) => ({ ...r, bonificacionARS: 0 }));
  }

  let allocated = 0;
  return rows.map((r, index) => {
    const isLast = index === rows.length - 1;
    let part;
    if (isLast) {
      part = roundMoney(bono - allocated);
    } else {
      part = roundMoney((Math.abs(toNumber(r.montoARS)) / absSum) * bono);
      allocated = roundMoney(allocated + part);
    }
    return { ...r, bonificacionARS: Math.max(0, part) };
  });
}

/**
 * Include Prisma común: imputación con cobro padre (para historial de reserva).
 */
const IMPUTACION_LIST_INCLUDE = {
  cobro: {
    include: {
      paymentMethodConfig: true,
      factura: true,
      adjuntos: true,
      discountApplications: true,
      imputaciones: { select: { id: true, accountId: true, reservaId: true, montoARS: true } }
    }
  },
  discountApplications: true
};

/**
 * Adapta una imputación al shape “cobro de folio” que espera la UI actual.
 */
function imputationToFolioCobroView(imp) {
  const cobro = imp.cobro || {};
  const allImps = cobro.imputaciones || [];
  const isMulti = allImps.length > 1;
  const da =
    (imp.discountApplications && imp.discountApplications[0]) ||
    (cobro.discountApplications || []).find((d) => d.cobroImputacionId === imp.id) ||
    (cobro.discountApplications || [])[0] ||
    null;

  return {
    ...cobro,
    id: cobro.id,
    // Crédito de este folio (no el total de caja si multi)
    montoARS: imp.montoARS,
    imputacionId: imp.id,
    imputacionMontoARS: imp.montoARS,
    bonificacionARS: imp.bonificacionARS,
    accountId: imp.accountId,
    reservaId: imp.reservaId,
    discountApplication: da,
    discountApplications: imp.discountApplications || cobro.discountApplications || [],
    esImputacionParcial: isMulti,
    pagoTotalARS: cobro.montoARS,
    cobroCodigo: cobro.codigo,
    imputacionesCount: allImps.length
  };
}

module.exports = {
  MONEY_EPS,
  assertFiniteMoney,
  validateImputaciones,
  autoDistributeOldestFirst,
  distributeBonificacion,
  IMPUTACION_LIST_INCLUDE,
  imputationToFolioCobroView
};
