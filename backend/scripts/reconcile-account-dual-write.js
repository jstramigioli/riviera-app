/**
 * Reconciliación dual-write Account: reservaId vs accountId.
 * Exit 0 si OK; exit 1 si hay desfasajes.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [
    reservations,
    reservationAccounts,
    orphanCounts,
    mismatchCargos,
    mismatchPagos,
    externalWithReserva
  ] = await Promise.all([
    prisma.reservation.count(),
    prisma.account.count({ where: { kind: 'RESERVATION' } }),
    prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM "Cargo" WHERE "accountId" IS NULL) AS orphan_cargos,
        (SELECT COUNT(*)::int FROM "Pago" WHERE "accountId" IS NULL) AS orphan_pagos
    `),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM "Cargo" c
      JOIN "Account" a ON a.id = c."accountId"
      WHERE a.kind = 'RESERVATION'
        AND (c."reservaId" IS NULL OR c."reservaId" <> a."reservationId")
    `),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM "Pago" p
      JOIN "Account" a ON a.id = p."accountId"
      WHERE a.kind = 'RESERVATION'
        AND (p."reservaId" IS NULL OR p."reservaId" <> a."reservationId")
    `),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM "Account" a
      WHERE a.kind = 'EXTERNAL' AND a."reservationId" IS NOT NULL
    `)
  ]);

  const report = {
    reservations,
    reservationAccounts,
    orphanCargos: orphanCounts[0]?.orphan_cargos ?? 0,
    orphanPagos: orphanCounts[0]?.orphan_pagos ?? 0,
    mismatchCargos: mismatchCargos[0]?.c ?? mismatchCargos[0]?.C ?? 0,
    mismatchPagos: mismatchPagos[0]?.c ?? mismatchPagos[0]?.C ?? 0,
    externalWithReserva:
      externalWithReserva[0]?.c ?? externalWithReserva[0]?.C ?? 0
  };

  console.log(JSON.stringify(report, null, 2));

  const ok =
    report.reservations === report.reservationAccounts &&
    report.orphanCargos === 0 &&
    report.orphanPagos === 0 &&
    report.mismatchCargos === 0 &&
    report.mismatchPagos === 0 &&
    report.externalWithReserva === 0;

  if (!ok) {
    console.error('RECONCILE_FAIL');
    process.exit(1);
  }
  console.log('RECONCILE_OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
