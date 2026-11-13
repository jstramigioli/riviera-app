/**
 * Seed idempotente del menú de consumos (bebidas / minutas / cafetería).
 * - Asegura subcategorías CONSUMO canónicas (BEBIDAS, MINUTAS, CAFETERIA)
 * - Inserta ítems base solo si no existe ya el mismo nombre+categoría
 *
 * Uso: node prisma/seed-menu-consumos.js
 * No pisa precios ni descripciones ya editados.
 */
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

const MENU_ITEMS = [
  { category: 'BEBIDAS', name: 'Agua mineral', price: 1500, ordenIndex: 10 },
  { category: 'BEBIDAS', name: 'Gaseosa', price: 2000, ordenIndex: 20 },
  { category: 'BEBIDAS', name: 'Cerveza', price: 3500, ordenIndex: 30 },
  { category: 'BEBIDAS', name: 'Vino copa', price: 4000, ordenIndex: 40 },
  { category: 'MINUTAS', name: 'Sandwich jamón y queso', price: 5500, ordenIndex: 10 },
  { category: 'MINUTAS', name: 'Ensalada mixta', price: 6000, ordenIndex: 20 },
  { category: 'MINUTAS', name: 'Milanesa con guarnición', price: 9500, ordenIndex: 30 },
  { category: 'CAFETERIA', name: 'Café', price: 1800, ordenIndex: 10 },
  { category: 'CAFETERIA', name: 'Café con leche', price: 2200, ordenIndex: 20 },
  { category: 'CAFETERIA', name: 'Té', price: 1600, ordenIndex: 30 },
  { category: 'CAFETERIA', name: 'Medialuna', price: 1200, ordenIndex: 40 }
];

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

async function ensureMenuItems() {
  let created = 0;
  for (const row of MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({
      where: {
        category: row.category,
        name: { equals: row.name, mode: 'insensitive' }
      }
    });
    if (existing) continue;
    await prisma.menuItem.create({
      data: {
        category: row.category,
        name: row.name,
        price: row.price,
        isActive: true,
        ordenIndex: row.ordenIndex
      }
    });
    created += 1;
  }
  return created;
}

async function main() {
  console.log('Seed menú consumos…');
  const subCreated = await ensureSubcategories();
  const itemsCreated = await ensureMenuItems();
  const totalItems = await prisma.menuItem.count();
  console.log(
    `Listo. Subcategorías nuevas: ${subCreated}. Ítems nuevos: ${itemsCreated}. Total ítems: ${totalItems}.`
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
