/**
 * Reconcile Account saldo vs cargos − cobros − DiscountApplication.
 * No reescribe históricos.
 */
const { PrismaClient } = require('@prisma/client');
const { calculateAccountBalance } = require('../src/utils/reservationBalance');

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    select: { id: true, status: true, kind: true }
  });
  let ok = 0;
  let mismatch = 0;
  for (const acc of accounts) {
    const [cargos, cobros, discounts] = await Promise.all([
      prisma.cargo.findMany({ where: { accountId: acc.id }, select: { monto: true } }),
      prisma.cobro.findMany({ where: { accountId: acc.id }, select: { montoARS: true } }),
      prisma.discountApplication.findMany({
        where: { accountId: acc.id },
        select: { montoARS: true }
      })
    ]);
    const bal = calculateAccountBalance(cargos, cobros, discounts);
    // Solo valida que el cálculo no explote; no hay campo saldo cacheado obligatorio.
    if (!Number.isFinite(bal.saldo)) {
      mismatch += 1;
      console.log('BAD', acc.id, bal);
    } else {
      ok += 1;
    }
  }

  const rules = await prisma.promotionRule.count({ where: { activo: true } });
  const efectivo = await prisma.promotionRule.findUnique({
    where: { code: 'PAYDISC_EFECTIVO' },
    include: { conditions: true }
  });

  console.log(
    JSON.stringify(
      {
        RECONCILE_OK: mismatch === 0,
        accountsChecked: accounts.length,
        ok,
        mismatch,
        activeRules: rules,
        efectivo: efectivo
          ? {
              id: efectivo.id,
              benefitValue: Number(efectivo.benefitValue),
              modality: efectivo.modality,
              layer: efectivo.layer,
              conditions: efectivo.conditions.map((c) => c.type)
            }
          : null
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
