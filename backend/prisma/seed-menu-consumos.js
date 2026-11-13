/**
 * Seed del menú de consumos desde precios reales (Excel hoja 202526).
 * - Asegura subcategorías CONSUMO canónicas (BEBIDAS, MINUTAS, CAFETERIA)
 * - Upsert por categoría+nombre: actualiza precio/descripción/orden/variedades
 * - Elimina ítems del seed demo viejo (y otros inactivos) que no estén en el Excel
 *
 * Uso: node prisma/seed-menu-consumos.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SUBCATEGORIES = [
  {
    tipo: 'CONSUMO',
    codigo: 'BEBIDAS',
    nombre: 'Bebidas',
    descripcion: 'Consumos de bebidas',
    color: '#3f5f8a',
    ordenIndex: 10
  },
  {
    tipo: 'CONSUMO',
    codigo: 'MINUTAS',
    nombre: 'Minutas',
    descripcion: 'Consumos de minutas / cocina',
    color: '#5a6f85',
    ordenIndex: 20
  },
  {
    tipo: 'CONSUMO',
    codigo: 'CAFETERIA',
    nombre: 'Cafetería',
    descripcion: 'Consumos de cafetería',
    color: '#6b7280',
    ordenIndex: 30
  }
];

/** Demo v1 — se desactivan si no coinciden con el catálogo Excel. */
const LEGACY_DEMO_NAMES = [
  'Agua mineral',
  'Gaseosa',
  'Cerveza',
  'Vino copa',
  'Sandwich jamón y queso',
  'Ensalada mixta',
  'Milanesa con guarnición',
  'Café',
  'Café con leche',
  'Té',
  'Medialuna'
];

function loadMenuCatalog() {
  const jsonPath = path.join(__dirname, 'menu-202526.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Catálogo vacío o inválido: ${jsonPath}`);
  }
  return rows;
}

async function ensureSubcategories() {
  let created = 0;
  for (const row of SUBCATEGORIES) {
    const existing = await prisma.subcategoriaCargo.findUnique({
      where: { tipo_codigo: { tipo: row.tipo, codigo: row.codigo } }
    });
    if (existing) continue;
    await prisma.subcategoriaCargo.create({
      data: {
        ...row,
        esActivo: true
      }
    });
    created += 1;
  }
  return created;
}

async function syncVarieties(menuItemId, varieties) {
  const desired = Array.isArray(varieties) ? varieties : [];
  const existing = await prisma.menuItemVariety.findMany({
    where: { menuItemId }
  });
  const byName = new Map(
    existing.map((v) => [String(v.name).trim().toLowerCase(), v])
  );
  const keepIds = new Set();

  for (const row of desired) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) continue;
    const ordenIndex = Number.isFinite(Number(row.ordenIndex))
      ? Number(row.ordenIndex)
      : 0;
    const key = name.toLowerCase();
    const found = byName.get(key);
    if (found) {
      await prisma.menuItemVariety.update({
        where: { id: found.id },
        data: { name, price, ordenIndex }
      });
      keepIds.add(found.id);
    } else {
      const created = await prisma.menuItemVariety.create({
        data: { menuItemId, name, price, ordenIndex }
      });
      keepIds.add(created.id);
    }
  }

  const toDelete = existing.filter((v) => !keepIds.has(v.id));
  if (toDelete.length) {
    await prisma.menuItemVariety.deleteMany({
      where: { id: { in: toDelete.map((v) => v.id) } }
    });
  }
}

async function upsertMenuItems(catalog) {
  let created = 0;
  let updated = 0;
  const catalogKeys = new Set();

  for (const row of catalog) {
    const category = row.category;
    const name = String(row.name || '').trim();
    if (!category || !name) continue;
    catalogKeys.add(`${category}::${name.toLowerCase()}`);

    const existing = await prisma.menuItem.findFirst({
      where: {
        category,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    const data = {
      category,
      name,
      price: row.price,
      description: row.description || null,
      ordenIndex: Number(row.ordenIndex) || 0,
      isActive: true
    };

    let itemId;
    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data });
      itemId = existing.id;
      updated += 1;
    } else {
      const createdItem = await prisma.menuItem.create({ data });
      itemId = createdItem.id;
      created += 1;
    }

    await syncVarieties(itemId, row.varieties || []);
  }

  return { created, updated, catalogKeys };
}

/**
 * Quita del catálogo los ítems del seed demo viejo (y leftovers inactivos)
 * que no coinciden con el Excel 202526. Cascada borra variedades.
 */
async function removeLegacyNotInCatalog(catalogKeys) {
  const legacyNameSet = new Set(LEGACY_DEMO_NAMES.map((n) => n.toLowerCase()));
  const candidates = await prisma.menuItem.findMany({
    select: { id: true, category: true, name: true, isActive: true }
  });

  const toDelete = candidates.filter((item) => {
    const key = `${item.category}::${item.name.trim().toLowerCase()}`;
    if (catalogKeys.has(key)) return false;
    const isLegacyName = legacyNameSet.has(item.name.trim().toLowerCase());
    return isLegacyName || item.isActive === false;
  });

  if (!toDelete.length) return 0;

  const result = await prisma.menuItem.deleteMany({
    where: { id: { in: toDelete.map((i) => i.id) } }
  });
  return result.count;
}

async function main() {
  console.log('Seed menú consumos (Excel 202526)…');
  const catalog = loadMenuCatalog();
  const subCreated = await ensureSubcategories();
  const { created, updated, catalogKeys } = await upsertMenuItems(catalog);
  const removed = await removeLegacyNotInCatalog(catalogKeys);
  const totalItems = await prisma.menuItem.count({ where: { isActive: true } });
  const totalAll = await prisma.menuItem.count();
  const totalVarieties = await prisma.menuItemVariety.count();
  console.log(
    `Listo. Subcategorías nuevas: ${subCreated}. Ítems creados: ${created}, actualizados: ${updated}, legacy eliminados: ${removed}. Activos: ${totalItems}/${totalAll}. Variedades: ${totalVarieties}.`
  );
}

main()
  .catch((err) => {
    console.error('Error en seed-menu-consumos:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
