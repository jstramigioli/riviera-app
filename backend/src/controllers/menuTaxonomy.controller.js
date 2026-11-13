const prisma = require('../utils/prisma');
const {
  CANONICAL_CONSUMO_GROUPS,
  LEGACY_SNACKS_CODE,
  normalizeCodigo,
  normalizeName,
  ensureCanonicalConsumoGroups,
  listMenuGroups
} = require('../utils/menuGroups');

exports.listGroups = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const data = await listMenuGroups({ includeInactive });
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error listando grupos de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar grupos',
      details: error.message
    });
  }
};

exports.createGroup = async (req, res) => {
  try {
    await ensureCanonicalConsumoGroups();
    const codigo = normalizeCodigo(req.body.codigo || req.body.code);
    const nombre = normalizeName(req.body.nombre || req.body.label);
    if (!codigo) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido',
        message: 'Usá letras/números/guión bajo (ej. BEBIDAS)'
      });
    }
    if (codigo === LEGACY_SNACKS_CODE) {
      return res.status(400).json({
        success: false,
        error: 'SNACKS no está permitido; usá BEBIDAS, MINUTAS o CAFETERIA'
      });
    }
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const color = req.body.color ? String(req.body.color).trim() : '#6b7280';
    const ordenIndex = Number.isFinite(Number(req.body.ordenIndex))
      ? Number(req.body.ordenIndex)
      : 100;

    const existing = await prisma.subcategoriaCargo.findUnique({
      where: { tipo_codigo: { tipo: 'CONSUMO', codigo } }
    });
    if (existing) {
      if (!existing.esActivo) {
        const reactivated = await prisma.subcategoriaCargo.update({
          where: { id: existing.id },
          data: { esActivo: true, nombre, color, ordenIndex }
        });
        return res.status(200).json({
          success: true,
          data: {
            id: reactivated.id,
            code: reactivated.codigo,
            label: reactivated.nombre,
            esActivo: reactivated.esActivo
          },
          reactivated: true
        });
      }
      return res.status(409).json({ success: false, error: `Ya existe el grupo ${codigo}` });
    }

    const created = await prisma.subcategoriaCargo.create({
      data: {
        tipo: 'CONSUMO',
        codigo,
        nombre,
        descripcion: req.body.descripcion ? String(req.body.descripcion).trim() : null,
        color,
        ordenIndex,
        esActivo: true
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        code: created.codigo,
        label: created.nombre,
        esActivo: created.esActivo,
        ordenIndex: created.ordenIndex
      }
    });
  } catch (error) {
    console.error('Error creando grupo de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear grupo',
      details: error.message
    });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const existing = await prisma.subcategoriaCargo.findFirst({
      where: { id, tipo: 'CONSUMO' }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Grupo no encontrado' });
    }
    if (existing.codigo === LEGACY_SNACKS_CODE) {
      return res.status(400).json({ success: false, error: 'SNACKS no se puede editar como grupo de menú' });
    }

    const data = {};
    if (req.body.nombre !== undefined || req.body.label !== undefined) {
      const nombre = normalizeName(req.body.nombre || req.body.label);
      if (!nombre) {
        return res.status(400).json({ success: false, error: 'El nombre es requerido' });
      }
      data.nombre = nombre;
    }
    if (req.body.descripcion !== undefined) {
      data.descripcion = req.body.descripcion
        ? String(req.body.descripcion).trim()
        : null;
    }
    if (req.body.color !== undefined) {
      data.color = String(req.body.color || '').trim() || existing.color;
    }
    if (req.body.ordenIndex !== undefined) {
      data.ordenIndex = Number(req.body.ordenIndex) || 0;
    }
    if (req.body.esActivo !== undefined) {
      data.esActivo = Boolean(req.body.esActivo);
    }

    // Renombrar código: actualiza ítems del menú
    let newCodigo = null;
    if (req.body.codigo !== undefined || req.body.code !== undefined) {
      newCodigo = normalizeCodigo(req.body.codigo || req.body.code);
      if (!newCodigo) {
        return res.status(400).json({ success: false, error: 'Código inválido' });
      }
      if (newCodigo === LEGACY_SNACKS_CODE) {
        return res.status(400).json({ success: false, error: 'SNACKS no está permitido' });
      }
      if (newCodigo !== existing.codigo) {
        const clash = await prisma.subcategoriaCargo.findUnique({
          where: { tipo_codigo: { tipo: 'CONSUMO', codigo: newCodigo } }
        });
        if (clash) {
          return res.status(409).json({ success: false, error: `Ya existe el grupo ${newCodigo}` });
        }
        data.codigo = newCodigo;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.subcategoriaCargo.update({ where: { id }, data });
      if (newCodigo && newCodigo !== existing.codigo) {
        await tx.menuItem.updateMany({
          where: { category: existing.codigo },
          data: { category: newCodigo }
        });
        await tx.menuSubgroup.updateMany({
          where: { category: existing.codigo },
          data: { category: newCodigo }
        });
      }
      return row;
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        code: updated.codigo,
        label: updated.nombre,
        esActivo: updated.esActivo,
        ordenIndex: updated.ordenIndex,
        isCanonical: CANONICAL_CONSUMO_GROUPS.some((c) => c.codigo === updated.codigo)
      }
    });
  } catch (error) {
    console.error('Error actualizando grupo de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar grupo',
      details: error.message
    });
  }
};

exports.toggleGroup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.subcategoriaCargo.findFirst({
      where: { id, tipo: 'CONSUMO' }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Grupo no encontrado' });
    }
    if (existing.codigo === LEGACY_SNACKS_CODE) {
      return res.status(400).json({ success: false, error: 'SNACKS no se puede reactivar' });
    }
    if (
      existing.esActivo &&
      CANONICAL_CONSUMO_GROUPS.some((c) => c.codigo === existing.codigo)
    ) {
      return res.status(400).json({
        success: false,
        error: 'No se pueden desactivar los grupos canónicos BEBIDAS, MINUTAS y CAFETERIA'
      });
    }

    const updated = await prisma.subcategoriaCargo.update({
      where: { id },
      data: { esActivo: !existing.esActivo }
    });
    res.json({
      success: true,
      data: {
        id: updated.id,
        code: updated.codigo,
        label: updated.nombre,
        esActivo: updated.esActivo
      }
    });
  } catch (error) {
    console.error('Error toggle grupo de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado del grupo',
      details: error.message
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.subcategoriaCargo.findFirst({
      where: { id, tipo: 'CONSUMO' },
      include: { _count: { select: { cargos: true } } }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Grupo no encontrado' });
    }
    if (CANONICAL_CONSUMO_GROUPS.some((c) => c.codigo === existing.codigo)) {
      return res.status(400).json({
        success: false,
        error: 'No se pueden eliminar los grupos canónicos BEBIDAS, MINUTAS y CAFETERIA'
      });
    }
    if (existing.codigo === LEGACY_SNACKS_CODE) {
      await prisma.subcategoriaCargo.update({
        where: { id },
        data: { esActivo: false }
      });
      return res.json({ success: true, message: 'SNACKS desactivado', soft: true });
    }

    const itemCount = await prisma.menuItem.count({ where: { category: existing.codigo } });
    if (itemCount > 0 || existing._count.cargos > 0) {
      await prisma.subcategoriaCargo.update({
        where: { id },
        data: { esActivo: false }
      });
      return res.json({
        success: true,
        message: 'Grupo desactivado (tiene ítems o cargos)',
        soft: true
      });
    }

    await prisma.menuSubgroup.deleteMany({ where: { category: existing.codigo } });
    await prisma.subcategoriaCargo.delete({ where: { id } });
    res.json({ success: true, message: 'Grupo eliminado', soft: false });
  } catch (error) {
    console.error('Error eliminando grupo de menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar grupo',
      details: error.message
    });
  }
};

exports.listSubgroups = async (req, res) => {
  try {
    const category = normalizeCodigo(req.query.category);
    const where = {};
    if (category) where.category = category;

    const rows = await prisma.menuSubgroup.findMany({
      where,
      orderBy: [{ category: 'asc' }, { ordenIndex: 'asc' }, { name: 'asc' }]
    });

    const itemCounts = await prisma.menuItem.groupBy({
      by: ['category', 'subgroup'],
      _count: { _all: true },
      where: {
        subgroup: { not: null },
        ...(category ? { category } : {})
      }
    });
    const countKey = (cat, name) => `${cat}::${String(name || '').trim().toLowerCase()}`;
    const counts = new Map(
      itemCounts
        .filter((r) => r.subgroup)
        .map((r) => [countKey(r.category, r.subgroup), r._count._all])
    );

    const data = rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      ordenIndex: r.ordenIndex,
      itemCount: counts.get(countKey(r.category, r.name)) || 0
    }));

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error listando subgrupos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar subgrupos',
      details: error.message
    });
  }
};

exports.createSubgroup = async (req, res) => {
  try {
    const category = normalizeCodigo(req.body.category);
    const name = normalizeName(req.body.name);
    if (!category || category === LEGACY_SNACKS_CODE) {
      return res.status(400).json({ success: false, error: 'Grupo inválido' });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const groups = await listMenuGroups({ includeInactive: false });
    if (!groups.some((g) => g.code === category)) {
      return res.status(400).json({ success: false, error: `Grupo inexistente o inactivo: ${category}` });
    }

    const ordenIndex = Number.isFinite(Number(req.body.ordenIndex))
      ? Number(req.body.ordenIndex)
      : 0;

    const created = await prisma.menuSubgroup.create({
      data: { category, name, ordenIndex }
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ya existe ese subgrupo en el grupo' });
    }
    console.error('Error creando subgrupo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear subgrupo',
      details: error.message
    });
  }
};

exports.updateSubgroup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const existing = await prisma.menuSubgroup.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subgrupo no encontrado' });
    }

    const data = {};
    let newName = existing.name;
    if (req.body.name !== undefined) {
      newName = normalizeName(req.body.name);
      if (!newName) {
        return res.status(400).json({ success: false, error: 'El nombre es requerido' });
      }
      data.name = newName;
    }
    if (req.body.ordenIndex !== undefined) {
      data.ordenIndex = Number(req.body.ordenIndex) || 0;
    }
    if (req.body.category !== undefined) {
      const category = normalizeCodigo(req.body.category);
      if (!category) {
        return res.status(400).json({ success: false, error: 'Grupo inválido' });
      }
      data.category = category;
    }

    const targetCategory = data.category || existing.category;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.menuSubgroup.update({ where: { id }, data });
      if (newName !== existing.name || targetCategory !== existing.category) {
        await tx.menuItem.updateMany({
          where: {
            category: existing.category,
            subgroup: existing.name
          },
          data: {
            category: targetCategory,
            subgroup: newName
          }
        });
      }
      return row;
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ya existe ese subgrupo en el grupo' });
    }
    console.error('Error actualizando subgrupo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar subgrupo',
      details: error.message
    });
  }
};

exports.deleteSubgroup = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.menuSubgroup.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subgrupo no encontrado' });
    }

    const clearItems = String(req.query.clearItems || '').toLowerCase() === 'true';
    const itemCount = await prisma.menuItem.count({
      where: { category: existing.category, subgroup: existing.name }
    });

    if (itemCount > 0 && !clearItems) {
      return res.status(400).json({
        success: false,
        error: `Hay ${itemCount} ítems en este subgrupo. Pasá clearItems=true para quitarles el subgrupo.`
      });
    }

    await prisma.$transaction(async (tx) => {
      if (clearItems && itemCount > 0) {
        await tx.menuItem.updateMany({
          where: { category: existing.category, subgroup: existing.name },
          data: { subgroup: null }
        });
      }
      await tx.menuSubgroup.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: clearItems ? 'Subgrupo eliminado y ítems sin subgrupo' : 'Subgrupo eliminado',
      clearedItems: clearItems ? itemCount : 0
    });
  } catch (error) {
    console.error('Error eliminando subgrupo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar subgrupo',
      details: error.message
    });
  }
};
