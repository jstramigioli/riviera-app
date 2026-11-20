const prisma = require('./prisma');

/** Grupos canónicos del menú / liquidación de consumos. */
const CANONICAL_CONSUMO_GROUPS = [
  {
    codigo: 'BEBIDAS',
    nombre: 'Bebidas',
    descripcion: 'Consumos de bebidas',
    color: '#3f5f8a',
    ordenIndex: 10
  },
  {
    codigo: 'MINUTAS',
    nombre: 'Minutas',
    descripcion: 'Consumos de minutas / cocina',
    color: '#5a6f85',
    ordenIndex: 20
  },
  {
    codigo: 'CAFETERIA',
    nombre: 'Cafetería',
    descripcion: 'Consumos de cafetería',
    color: '#6b7280',
    ordenIndex: 30
  }
];

const LEGACY_SNACKS_CODE = 'SNACKS';

function normalizeCodigo(value) {
  if (value == null) return null;
  const code = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  if (!code) return null;
  if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(code)) return null;
  return code;
}

function normalizeName(value) {
  const name = String(value || '').trim();
  return name || null;
}

/**
 * Asegura BEBIDAS/MINUTAS/CAFETERIA y desactiva SNACKS.
 * Idempotente; se llama al listar/mutar grupos de menú.
 */
async function ensureCanonicalConsumoGroups(tx = prisma) {
  for (const row of CANONICAL_CONSUMO_GROUPS) {
    await tx.subcategoriaCargo.upsert({
      where: { tipo_codigo: { tipo: 'CONSUMO', codigo: row.codigo } },
      create: {
        tipo: 'CONSUMO',
        codigo: row.codigo,
        nombre: row.nombre,
        descripcion: row.descripcion,
        color: row.color,
        ordenIndex: row.ordenIndex,
        esActivo: true
      },
      update: {
        esActivo: true,
        nombre: row.nombre,
        ordenIndex: row.ordenIndex
      }
    });
  }

  await tx.subcategoriaCargo.updateMany({
    where: { tipo: 'CONSUMO', codigo: LEGACY_SNACKS_CODE },
    data: { esActivo: false }
  });
}

async function listMenuGroups({ includeInactive = false } = {}) {
  await ensureCanonicalConsumoGroups();
  const where = { tipo: 'CONSUMO' };
  if (!includeInactive) where.esActivo = true;

  const rows = await prisma.subcategoriaCargo.findMany({
    where,
    include: {
      _count: { select: { cargos: true } }
    },
    orderBy: [{ ordenIndex: 'asc' }, { nombre: 'asc' }]
  });

  // Snacks nunca se ofrece como grupo de menú, aunque estuviera activo por error.
  const filtered = rows.filter((r) => r.codigo !== LEGACY_SNACKS_CODE);

  const itemCounts = await prisma.menuItem.groupBy({
    by: ['category'],
    _count: { _all: true }
  });
  const countByCode = new Map(itemCounts.map((r) => [r.category, r._count._all]));

  return filtered.map((r) => ({
    id: r.id,
    code: r.codigo,
    label: r.nombre,
    descripcion: r.descripcion,
    color: r.color,
    ordenIndex: r.ordenIndex,
    esActivo: r.esActivo,
    isCanonical: CANONICAL_CONSUMO_GROUPS.some((c) => c.codigo === r.codigo),
    itemCount: countByCode.get(r.codigo) || 0,
    cargoCount: r._count?.cargos || 0
  }));
}

async function resolveActiveCategoryCodes() {
  const groups = await listMenuGroups({ includeInactive: false });
  return groups.map((g) => g.code);
}

async function normalizeCategory(value) {
  const code = normalizeCodigo(value);
  if (!code || code === LEGACY_SNACKS_CODE) return null;
  const active = await resolveActiveCategoryCodes();
  return active.includes(code) ? code : null;
}

module.exports = {
  CANONICAL_CONSUMO_GROUPS,
  LEGACY_SNACKS_CODE,
  normalizeCodigo,
  normalizeName,
  ensureCanonicalConsumoGroups,
  listMenuGroups,
  resolveActiveCategoryCodes,
  normalizeCategory
};
