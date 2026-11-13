const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');

const MENU_CATEGORIES = ['BEBIDAS', 'MINUTAS', 'CAFETERIA'];

const CATEGORY_LABELS = {
  BEBIDAS: 'Bebidas',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería'
};

const varietyInclude = {
  varieties: { orderBy: [{ ordenIndex: 'asc' }, { name: 'asc' }] }
};

function normalizeCategory(value) {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  return MENU_CATEGORIES.includes(upper) ? upper : null;
}

function parsePrice(value) {
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num < 0) return null;
  return new Decimal(num);
}

function normalizeVarieties(raw) {
  if (raw === undefined) return undefined;
  if (raw === null) return [];
  if (!Array.isArray(raw)) return null;

  const out = [];
  const seen = new Set();
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i] || {};
    const name = String(row.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { error: `Variedad duplicada: ${name}` };
    }
    seen.add(key);
    const price = parsePrice(row.price);
    if (price === null) {
      return { error: `Precio inválido en variedad “${name}”` };
    }
    const ordenIndex = Number.isFinite(Number(row.ordenIndex))
      ? Number(row.ordenIndex)
      : (i + 1) * 10;
    out.push({ name, price, ordenIndex });
  }
  return out;
}

async function replaceVarieties(tx, menuItemId, varieties) {
  await tx.menuItemVariety.deleteMany({ where: { menuItemId } });
  if (!varieties.length) return;
  await tx.menuItemVariety.createMany({
    data: varieties.map((v) => ({
      menuItemId,
      name: v.name,
      price: v.price,
      ordenIndex: v.ordenIndex
    }))
  });
}

exports.listCategories = async (_req, res) => {
  res.json({
    success: true,
    data: MENU_CATEGORIES.map((code) => ({
      code,
      label: CATEGORY_LABELS[code]
    }))
  });
};

exports.listMenuItems = async (req, res) => {
  try {
    const { category, q, active } = req.query;
    const where = {};

    const cat = normalizeCategory(category);
    if (category && !cat) {
      return res.status(400).json({
        success: false,
        error: 'Categoría inválida',
        message: `Usá una de: ${MENU_CATEGORIES.join(', ')}`
      });
    }
    if (cat) where.category = cat;

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    if (q && String(q).trim()) {
      where.name = { contains: String(q).trim(), mode: 'insensitive' };
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: varietyInclude,
      orderBy: [
        { category: 'asc' },
        { ordenIndex: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    console.error('Error listando menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar ítems del menú',
      details: error.message
    });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const category = normalizeCategory(req.body.category);
    const name = String(req.body.name || '').trim();
    const price = parsePrice(req.body.price);
    const description = req.body.description ? String(req.body.description).trim() : null;
    const ordenIndex = Number.isFinite(Number(req.body.ordenIndex))
      ? Number(req.body.ordenIndex)
      : 0;
    const varietiesNorm = normalizeVarieties(req.body.varieties);

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Categoría requerida',
        message: `Usá una de: ${MENU_CATEGORIES.join(', ')}`
      });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    if (price === null) {
      return res.status(400).json({ success: false, error: 'Precio inválido' });
    }
    if (varietiesNorm && varietiesNorm.error) {
      return res.status(400).json({ success: false, error: varietiesNorm.error });
    }

    const varieties = Array.isArray(varietiesNorm) ? varietiesNorm : [];
    const basePrice =
      varieties.length > 0 ? varieties[0].price : price;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          category,
          name,
          price: basePrice,
          description,
          ordenIndex,
          isActive: req.body.isActive !== false
        }
      });
      if (varieties.length) {
        await replaceVarieties(tx, created.id, varieties);
      }
      return tx.menuItem.findUnique({
        where: { id: created.id },
        include: varietyInclude
      });
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Error creando ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear ítem del menú',
      details: error.message
    });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ítem no encontrado' });
    }

    const data = {};
    if (req.body.category !== undefined) {
      const category = normalizeCategory(req.body.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Categoría inválida',
          message: `Usá una de: ${MENU_CATEGORIES.join(', ')}`
        });
      }
      data.category = category;
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, error: 'El nombre es requerido' });
      }
      data.name = name;
    }
    if (req.body.price !== undefined) {
      const price = parsePrice(req.body.price);
      if (price === null) {
        return res.status(400).json({ success: false, error: 'Precio inválido' });
      }
      data.price = price;
    }
    if (req.body.description !== undefined) {
      data.description = req.body.description
        ? String(req.body.description).trim()
        : null;
    }
    if (req.body.ordenIndex !== undefined) {
      data.ordenIndex = Number(req.body.ordenIndex) || 0;
    }
    if (req.body.isActive !== undefined) {
      data.isActive = Boolean(req.body.isActive);
    }

    const varietiesNorm = normalizeVarieties(req.body.varieties);
    if (varietiesNorm && varietiesNorm.error) {
      return res.status(400).json({ success: false, error: varietiesNorm.error });
    }

    const item = await prisma.$transaction(async (tx) => {
      if (Array.isArray(varietiesNorm)) {
        await replaceVarieties(tx, id, varietiesNorm);
        if (varietiesNorm.length > 0 && req.body.price === undefined) {
          data.price = varietiesNorm[0].price;
        }
      }
      await tx.menuItem.update({ where: { id }, data });
      return tx.menuItem.findUnique({
        where: { id },
        include: varietyInclude
      });
    });

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error actualizando ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar ítem del menú',
      details: error.message
    });
  }
};

exports.toggleMenuItem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.menuItem.findUnique({
      where: { id },
      include: varietyInclude
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ítem no encontrado' });
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: varietyInclude
    });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error toggle ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado del ítem',
      details: error.message
    });
  }
};

/**
 * Baja lógica: desactiva el ítem (no borra la fila).
 * Los cargos históricos ya guardan descripción/monto en Cargo; el catálogo sigue trazable.
 * Query ?hard=true permite borrado físico (solo settings / uso excepcional).
 */
exports.deleteMenuItem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ítem no encontrado' });
    }

    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    if (hard) {
      await prisma.menuItem.delete({ where: { id } });
      return res.json({ success: true, message: 'Ítem eliminado', hard: true });
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
      include: varietyInclude
    });
    res.json({
      success: true,
      message: 'Ítem desactivado',
      data: item,
      hard: false
    });
  } catch (error) {
    console.error('Error eliminando ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar ítem del menú',
      details: error.message
    });
  }
};

exports.MENU_CATEGORIES = MENU_CATEGORIES;
exports.CATEGORY_LABELS = CATEGORY_LABELS;
