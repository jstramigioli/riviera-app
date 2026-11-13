/**
 * Reconciliación: saldo_legacy (cargos−pagos) − totalDescuentos === saldo_nuevo
 * Uso: node scripts/reconcile-payment-discounts.js
 */
const { PrismaClient } = require('@prisma/client');
const { calculateAccountBalance } = require('../src/utils/reservationBalance');

const prisma = new PrismaClient();

function toN(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      kind: true,
      reservationId: true,
      cargos: { select: { monto: true } },
      pagos: { select: { montoARS: true } },
      discountApplications: { select: { montoARS: true } }
    }
  });

  let ok = 0;
  let mismatch = 0;
  for (const a of accounts) {
    const cargos = a.cargos.reduce((s, c) => s + toN(c.monto), 0);
    const pagos = a.pagos.reduce((s, p) => s + toN(p.montoARS), 0);
    const desc = a.discountApplications.reduce((s, d) => s + toN(d.montoARS), 0);
    const legacy = cargos - pagos;
    const neu = calculateAccountBalance(a.cargos, a.pagos, a.discountApplications).saldo;
    const expected = legacy - desc;
    if (Math.abs(neu - expected) > 0.009) {
      mismatch += 1;
      console.log('MISMATCH', {
        accountId: a.id,
        kind: a.kind,
        reservationId: a.reservationId,
        legacy,
        desc,
        expected,
        neu
      });
    } else {
      ok += 1;
    }
  }

  console.log(
    mismatch === 0
      ? `RECONCILE_OK accounts=${ok} discounts_sum_checked`
      : `RECONCILE_FAIL ok=${ok} mismatch=${mismatch}`
  );
  if (mismatch > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
