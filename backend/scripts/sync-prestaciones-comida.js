/**
 * Genera / sincroniza las comidas previstas (PrestacionComida REGIMEN) de
 * todas las reservas a partir de sus tramos y del régimen de cada servicio.
 * Idempotente: se puede correr las veces que haga falta.
 *
 * Uso (desde backend/, con backup previo de la DB):
 *   npm run sync:comidas -- --dry-run      # solo muestra qué cambiaría
 *   npm run sync:comidas                   # aplica
 *   npm run sync:comidas -- --reserva 123  # una sola reserva
 */
require('dotenv').config();
const prisma = require('../src/utils/prisma');
const {
  syncPrestacionesComida,
  loadServiceTypesById
} = require('../src/utils/prestacionesComida');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const idx = args.indexOf('--reserva');
  const onlyId = idx >= 0 ? parseInt(args[idx + 1], 10) : null;

  const serviceTypesById = await loadServiceTypesById(prisma);
  const sinRegimen = [...serviceTypesById.values()].filter(
    (st) => !st.incluyeDesayuno && !st.incluyeCena
  ).length;
  console.log(
    `Servicios: ${serviceTypesById.size} (${sinRegimen} sin comidas incluidas)${dryRun ? ' — DRY RUN' : ''}`
  );

  const reservations = await prisma.reservation.findMany({
    where: onlyId ? { id: onlyId } : {},
    select: { id: true },
    orderBy: { id: 'asc' }
  });

  const totals = { reservas: 0, created: 0, updated: 0, removed: 0 };
  for (const { id } of reservations) {
    const r = await syncPrestacionesComida(id, { serviceTypesById, dryRun });
    if (!r) continue;
    totals.reservas += 1;
    totals.created += r.created;
    totals.updated += r.updated;
    totals.removed += r.removed;
  }

  console.log(
    `Reservas revisadas: ${totals.reservas} · nuevas: ${totals.created} · actualizadas: ${totals.updated} · eliminadas: ${totals.removed}`
  );
}

main()
  .catch((error) => {
    console.error('Error sincronizando comidas:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
