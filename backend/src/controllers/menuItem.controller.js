const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');

const MENU_CATEGORIES = ['BEBIDAS', 'MINUTAS', 'CAFETERIA'];

const CATEGORY_LABELS = {
  BEBIDAS: 'Bebidas',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería'
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

    const item = await prisma.menuItem.create({
      data: {
        category,
        name,
        price,
        description,
        ordenIndex,
        isActive: req.body.isActive !== false
      }
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

    const item = await prisma.menuItem.update({ where: { id }, data });
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ítem no encontrado' });
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: { isActive: !existing.isActive }
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

exports.deleteMenuItem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ítem no encontrado' });
    }

    await prisma.menuItem.delete({ where: { id } });
    res.json({ success: true, message: 'Ítem eliminado' });
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
