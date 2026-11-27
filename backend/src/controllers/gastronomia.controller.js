const { normalizeDishName } = require('../utils/dishNameNorm');
const {
  sectionToDishCategory,
  isValidDishCategory
} = require('../utils/dishCatalogCategory');
const {
  buildDailyMenuPdfBuffer,
  CONVENTIONAL_ORDER,
  MESA_ENSALADAS
} = require('../services/dailyMenuPdf');

const prisma = require('../utils/prisma');

const VALID_KINDS = new Set(['CONVENTIONAL', 'BUFFET']);
const VALID_STATUSES = new Set(['DRAFT', 'PUBLISHED']);
const VALID_SECTIONS = new Set([
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PRIMER_PLATO',
  'SEGUNDO_PLATO',
  'PLATO_INFANTIL',
  'POSTRE',
  'BUFFET'
]);

function parseCivilDate(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // DATE columns: noon UTC avoids off-by-one in most TZ
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function toCivilIso(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    return dateValue.slice(0, 10);
  }
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function serializeMenu(menu) {
  if (!menu) return null;
  return {
    ...menu,
    date: toCivilIso(menu.date),
    items: (menu.items || [])
      .slice()
      .sort(
        (a, b) =>
          (a.sortOrder || 0) - (b.sortOrder || 0) ||
          String(a.section).localeCompare(String(b.section))
      )
  };
}

function previewFromItems(items, kind) {
  const list = (items || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (!list.length) return '';
  if (kind === 'BUFFET') {
    return list
      .slice(0, 3)
      .map((i) => i.nameSnapshot)
      .join(' · ');
  }
  const parts = [];
  for (const section of CONVENTIONAL_ORDER) {
    const hit = list.find((i) => i.section === section);
    if (hit) parts.push(hit.nameSnapshot);
    if (parts.length >= 2) break;
  }
  return parts.join(' · ');
}

function serializeMenuSummary(menu) {
  const full = serializeMenu(menu);
  return {
    id: full.id,
    date: full.date,
    kind: full.kind,
    status: full.status,
    notes: full.notes,
    publishedAt: full.publishedAt,
    updatedAt: full.updatedAt,
    itemCount: (full.items || []).length,
    preview: previewFromItems(full.items, full.kind)
  };
}

async function resolveDish(tx, nameRaw, description, sectionOrCategory) {
  const name = String(nameRaw || '').trim();
  if (!name) return { error: 'Nombre de plato vacío' };
  const nameNorm = normalizeDishName(name);
  if (!nameNorm) return { error: 'Nombre de plato inválido' };

  const raw = String(sectionOrCategory || '').toUpperCase();
  const category =
    sectionToDishCategory(raw) || (isValidDishCategory(raw) ? raw : null);
  if (!category) return { error: 'Categoría de plato inválida' };

  let dish = await tx.dishCatalog.findUnique({
    where: { nameNorm_category: { nameNorm, category } }
  });
  let created = false;
  let softDupe = false;

  if (!dish) {
    dish = await tx.dishCatalog.create({
      data: {
        name,
        nameNorm,
        category,
        usageCount: 1,
        lastUsedAt: new Date()
      }
    });
    created = true;
  } else {
    softDupe = dish.name !== name;
    await tx.dishCatalog.update({
      where: { id: dish.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
  }

  return {
    dish,
    created,
    softDupe,
    nameSnapshot: name,
    descriptionSnap: description != null && String(description).trim()
      ? String(description).trim()
      : null
  };
}

function normalizeIncomingItems(kind, items) {
  const list = Array.isArray(items) ? items : [];
  const out = [];
  let order = 0;
  for (const raw of list) {
    let section = String(raw?.section || '').toUpperCase();
    if (kind === 'BUFFET') section = 'BUFFET';
    if (!VALID_SECTIONS.has(section)) continue;
    if (kind === 'CONVENTIONAL' && section === 'BUFFET') continue;
    // Ensaladas: no editable; se fuerza siempre «mesa de ensaladas».
    if (kind === 'CONVENTIONAL' && section === 'ENSALADA') continue;
    const name = String(raw?.name || raw?.nameSnapshot || '').trim();
    if (!name) continue;
    out.push({
      section,
      sortOrder:
        Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : order,
      name,
      description: raw?.description ?? raw?.descriptionSnap ?? null
    });
    order += 1;
  }
  if (kind === 'CONVENTIONAL') {
    out.push({
      section: 'ENSALADA',
      sortOrder: order,
      name: MESA_ENSALADAS,
      description: null
    });
  }
  out.sort((a, b) => {
    const ai = CONVENTIONAL_ORDER.indexOf(a.section);
    const bi = CONVENTIONAL_ORDER.indexOf(b.section);
    const ao = ai === -1 ? 999 : ai;
    const bo = bi === -1 ? 999 : bi;
    if (ao !== bo) return ao - bo;
    return a.sortOrder - b.sortOrder;
  });
  out.forEach((row, idx) => {
    row.sortOrder = idx;
  });
  return out;
}

const menuInclude = {
  items: { orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }] }
};

exports.listDailyMenus = async (req, res) => {
  try {
    const from = parseCivilDate(req.query.from);
    const to = parseCivilDate(req.query.to);
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }
    const rows = await prisma.dailyMenu.findMany({
      where,
      include: menuInclude,
      orderBy: { date: 'desc' }
    });
    res.json(rows.map(serializeMenuSummary));
  } catch (error) {
    console.error('listDailyMenus', error);
    res.status(500).json({ error: 'Error al listar menús', details: error.message });
  }
};

exports.getDailyMenuById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const menu = await prisma.dailyMenu.findUnique({
      where: { id },
      include: menuInclude
    });
    if (!menu) return res.status(404).json({ error: 'Menú no encontrado' });
    res.json(serializeMenu(menu));
  } catch (error) {
    console.error('getDailyMenuById', error);
    res.status(500).json({ error: 'Error al obtener menú', details: error.message });
  }
};

exports.getDailyMenuByDate = async (req, res) => {
  try {
    const date = parseCivilDate(req.params.date);
    if (!date) return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD)' });
    const menu = await prisma.dailyMenu.findUnique({
      where: { date },
      include: menuInclude
    });
    if (!menu) return res.status(404).json({ error: 'No hay menú para esa fecha' });
    res.json(serializeMenu(menu));
  } catch (error) {
    console.error('getDailyMenuByDate', error);
    res.status(500).json({ error: 'Error al obtener menú', details: error.message });
  }
};

exports.createDailyMenu = async (req, res) => {
  try {
    const date = parseCivilDate(req.body?.date);
    const kind = String(req.body?.kind || 'CONVENTIONAL').toUpperCase();
    const status = String(req.body?.status || 'DRAFT').toUpperCase();
    if (!date) return res.status(400).json({ error: 'Fecha requerida (YYYY-MM-DD)' });
    if (!VALID_KINDS.has(kind)) return res.status(400).json({ error: 'Tipo de menú inválido' });
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Estado inválido' });

    const existing = await prisma.dailyMenu.findUnique({ where: { date } });
    if (existing) {
      return res.status(409).json({
        error: 'Ya existe un menú para esa fecha',
        existingId: existing.id
      });
    }

    const incoming = normalizeIncomingItems(kind, req.body?.items);
    const warnings = [];

    const menu = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyMenu.create({
        data: {
          date,
          kind,
          status,
          notes: req.body?.notes != null ? String(req.body.notes) : null,
          publishedAt: status === 'PUBLISHED' ? new Date() : null
        }
      });

      for (const row of incoming) {
        const resolved = await resolveDish(
          tx,
          row.name,
          row.description,
          row.section
        );
        if (resolved.error) throw new Error(resolved.error);
        if (resolved.softDupe) {
          warnings.push({
            type: 'SOFT_DUPLICATE',
            name: row.name,
            catalogName: resolved.dish.name
          });
        }
        await tx.dailyMenuItem.create({
          data: {
            dailyMenuId: created.id,
            section: row.section,
            sortOrder: row.sortOrder,
            nameSnapshot: resolved.nameSnapshot,
            descriptionSnap: resolved.descriptionSnap,
            dishCatalogId: resolved.dish.id
          }
        });
      }

      return tx.dailyMenu.findUnique({
        where: { id: created.id },
        include: menuInclude
      });
    });

    res.status(201).json({ ...serializeMenu(menu), warnings });
  } catch (error) {
    console.error('createDailyMenu', error);
    res.status(500).json({ error: 'Error al crear menú', details: error.message });
  }
};

exports.updateDailyMenu = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const current = await prisma.dailyMenu.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Menú no encontrado' });

    let date = current.date;
    if (req.body?.date != null) {
      const parsed = parseCivilDate(req.body.date);
      if (!parsed) return res.status(400).json({ error: 'Fecha inválida' });
      if (toCivilIso(parsed) !== toCivilIso(current.date)) {
        const clash = await prisma.dailyMenu.findUnique({ where: { date: parsed } });
        if (clash && clash.id !== id) {
          return res.status(409).json({
            error: 'Ya existe un menú para esa fecha',
            existingId: clash.id
          });
        }
        date = parsed;
      }
    }

    const kind = req.body?.kind
      ? String(req.body.kind).toUpperCase()
      : current.kind;
    if (!VALID_KINDS.has(kind)) return res.status(400).json({ error: 'Tipo inválido' });

    let status = current.status;
    if (req.body?.status != null) {
      status = String(req.body.status).toUpperCase();
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
    }

    const replaceItems = Array.isArray(req.body?.items);
    const incoming = replaceItems
      ? normalizeIncomingItems(kind, req.body.items)
      : null;
    const warnings = [];

    const menu = await prisma.$transaction(async (tx) => {
      await tx.dailyMenu.update({
        where: { id },
        data: {
          date,
          kind,
          status,
          notes:
            req.body?.notes !== undefined
              ? req.body.notes != null
                ? String(req.body.notes)
                : null
              : undefined,
          publishedAt:
            status === 'PUBLISHED'
              ? current.publishedAt || new Date()
              : status === 'DRAFT'
                ? null
                : undefined
        }
      });

      if (replaceItems) {
        await tx.dailyMenuItem.deleteMany({ where: { dailyMenuId: id } });
        for (const row of incoming) {
          const resolved = await resolveDish(
            tx,
            row.name,
            row.description,
            row.section
          );
          if (resolved.error) throw new Error(resolved.error);
          if (resolved.softDupe) {
            warnings.push({
              type: 'SOFT_DUPLICATE',
              name: row.name,
              catalogName: resolved.dish.name
            });
          }
          await tx.dailyMenuItem.create({
            data: {
              dailyMenuId: id,
              section: row.section,
              sortOrder: row.sortOrder,
              nameSnapshot: resolved.nameSnapshot,
              descriptionSnap: resolved.descriptionSnap,
              dishCatalogId: resolved.dish.id
            }
          });
        }
      }

      return tx.dailyMenu.findUnique({
        where: { id },
        include: menuInclude
      });
    });

    res.json({ ...serializeMenu(menu), warnings });
  } catch (error) {
    console.error('updateDailyMenu', error);
    res.status(500).json({ error: 'Error al actualizar menú', details: error.message });
  }
};

exports.patchDailyMenuStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body?.status || '').toUpperCase();
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const current = await prisma.dailyMenu.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Menú no encontrado' });

    const menu = await prisma.dailyMenu.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? current.publishedAt || new Date() : null
      },
      include: menuInclude
    });
    res.json(serializeMenu(menu));
  } catch (error) {
    console.error('patchDailyMenuStatus', error);
    res.status(500).json({ error: 'Error al cambiar estado', details: error.message });
  }
};

exports.copyDailyMenu = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetDate = parseCivilDate(req.body?.targetDate);
    if (!targetDate) {
      return res.status(400).json({ error: 'targetDate requerido (YYYY-MM-DD)' });
    }
    const source = await prisma.dailyMenu.findUnique({
      where: { id },
      include: menuInclude
    });
    if (!source) return res.status(404).json({ error: 'Menú origen no encontrado' });

    const clash = await prisma.dailyMenu.findUnique({ where: { date: targetDate } });
    if (clash) {
      return res.status(409).json({
        error: 'Ya existe un menú para la fecha destino',
        existingId: clash.id
      });
    }

    const menu = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyMenu.create({
        data: {
          date: targetDate,
          kind: source.kind,
          status: 'DRAFT',
          notes: source.notes,
          publishedAt: null
        }
      });
      for (const item of source.items || []) {
        let dishCatalogId = item.dishCatalogId;
        if (dishCatalogId) {
          await tx.dishCatalog.update({
            where: { id: dishCatalogId },
            data: { usageCount: { increment: 1 }, lastUsedAt: new Date() }
          });
        } else {
          const resolved = await resolveDish(
            tx,
            item.nameSnapshot,
            item.descriptionSnap,
            item.section
          );
          if (resolved.error) throw new Error(resolved.error);
          dishCatalogId = resolved.dish.id;
        }
        await tx.dailyMenuItem.create({
          data: {
            dailyMenuId: created.id,
            section: item.section,
            sortOrder: item.sortOrder,
            nameSnapshot: item.nameSnapshot,
            descriptionSnap: item.descriptionSnap,
            dishCatalogId
          }
        });
      }
      return tx.dailyMenu.findUnique({
        where: { id: created.id },
        include: menuInclude
      });
    });

    res.status(201).json(serializeMenu(menu));
  } catch (error) {
    console.error('copyDailyMenu', error);
    res.status(500).json({ error: 'Error al copiar menú', details: error.message });
  }
};

exports.getDailyMenuPdf = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const menu = await prisma.dailyMenu.findUnique({
      where: { id },
      include: menuInclude
    });
    if (!menu) return res.status(404).json({ error: 'Menú no encontrado' });
    const buffer = await buildDailyMenuPdfBuffer(menu);
    const dateIso = toCivilIso(menu.date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="menu-riviera-${dateIso}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('getDailyMenuPdf', error);
    res.status(500).json({ error: 'Error al generar PDF', details: error.message });
  }
};

exports.searchDishes = async (req, res) => {
  try {
    const q = normalizeDishName(req.query.q || '');
    const take = Math.min(parseInt(req.query.limit, 10) || 20, 200);
    const categoryRaw = String(req.query.category || '').toUpperCase();
    const sectionRaw = String(req.query.section || '').toUpperCase();
    let category = null;
    if (categoryRaw) {
      if (!isValidDishCategory(categoryRaw)) {
        return res.status(400).json({ error: 'Categoría inválida' });
      }
      category = categoryRaw;
    } else if (sectionRaw) {
      category = sectionToDishCategory(sectionRaw);
      if (!category) {
        return res.status(400).json({ error: 'Sección inválida' });
      }
    }
    const where = {};
    if (q) where.nameNorm = { contains: q };
    if (category) where.category = category;
    const rows = await prisma.dishCatalog.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' },
        { name: 'asc' }
      ],
      take
    });
    res.json(rows);
  } catch (error) {
    console.error('searchDishes', error);
    res.status(500).json({ error: 'Error al buscar platos', details: error.message });
  }
};

exports.renameDish = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const current = await prisma.dishCatalog.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Plato no encontrado' });

    const name =
      req.body?.name != null ? String(req.body.name).trim() : current.name;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const nameNorm = normalizeDishName(name);

    let category = current.category;
    if (req.body?.category != null) {
      const nextCat = String(req.body.category).toUpperCase();
      if (!isValidDishCategory(nextCat)) {
        return res.status(400).json({ error: 'Categoría inválida' });
      }
      category = nextCat;
    }

    const other = await prisma.dishCatalog.findUnique({
      where: { nameNorm_category: { nameNorm, category } }
    });
    if (other && other.id !== id) {
      return res.status(409).json({
        error:
          'Ya existe un plato con ese nombre en la misma categoría (o equivalente sin acentos)',
        existingId: other.id,
        existingName: other.name,
        category
      });
    }
    const dish = await prisma.dishCatalog.update({
      where: { id },
      data: { name, nameNorm, category }
    });
    res.json(dish);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
    console.error('renameDish', error);
    res.status(500).json({ error: 'Error al renombrar plato', details: error.message });
  }
};

exports.deleteDish = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const refs = await prisma.dailyMenuItem.count({ where: { dishCatalogId: id } });
    if (refs > 0) {
      return res.status(409).json({
        error: 'No se puede borrar: el plato tiene referencias en menús históricos',
        refs
      });
    }
    await prisma.dishCatalog.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
    console.error('deleteDish', error);
    res.status(500).json({ error: 'Error al borrar plato', details: error.message });
  }
};

// Helpers exportados para tests
exports._internal = {
  parseCivilDate,
  toCivilIso,
  normalizeIncomingItems,
  normalizeDishName,
  previewFromItems,
  sectionToDishCategory
};
