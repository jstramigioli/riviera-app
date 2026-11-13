const {
  listMenuGroups,
  ensureCanonicalConsumoGroups
} = require('../src/utils/menuGroups');
const prisma = require('../src/utils/prisma');

(async () => {
  await ensureCanonicalConsumoGroups();
  const groups = await listMenuGroups({ includeInactive: true });
  const subgroups = await prisma.menuSubgroup.count();
  const snacks = await prisma.subcategoriaCargo.findFirst({
    where: { tipo: 'CONSUMO', codigo: 'SNACKS' }
  });
  const result = {
    ok:
      groups.filter((g) => g.esActivo).map((g) => g.code).sort().join(',') ===
        'BEBIDAS,CAFETERIA,MINUTAS' &&
      snacks &&
      snacks.esActivo === false &&
      subgroups >= 13,
    activeGroups: groups.filter((g) => g.esActivo).map((g) => g.code),
    snacksActive: snacks?.esActivo ?? null,
    subgroups
  };
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
