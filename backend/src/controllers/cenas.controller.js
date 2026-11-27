const prisma = require('../utils/prisma');
const {
  CenaInputError,
  listTiposCena,
  createTipoCena,
  updateTipoCena,
  deleteTipoCena
} = require('../utils/cenas');

function handleError(res, error, fallback) {
  if (error instanceof CenaInputError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback, details: error.message });
}

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new CenaInputError('id inválido');
  return id;
}

/** GET /api/cenas/tipos?includeInactive=1 */
exports.listTipos = async (req, res) => {
  try {
    const includeInactive = ['1', 'true'].includes(String(req.query.includeInactive || ''));
    res.json({ success: true, data: await listTiposCena(prisma, { includeInactive }) });
  } catch (error) {
    handleError(res, error, 'Error al listar tipos de cena');
  }
};

/** POST /api/cenas/tipos { nombre, precioAlojado, precioExterno } */
exports.createTipo = async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await createTipoCena(prisma, req.body || {}) });
  } catch (error) {
    handleError(res, error, 'Error al crear el tipo de cena');
  }
};

/** PUT /api/cenas/tipos/:id { nombre?, precioAlojado?, precioExterno?, activo?, ordenIndex? } */
exports.updateTipo = async (req, res) => {
  try {
    res.json({ success: true, data: await updateTipoCena(prisma, parseId(req), req.body || {}) });
  } catch (error) {
    handleError(res, error, 'Error al actualizar el tipo de cena');
  }
};

/** DELETE /api/cenas/tipos/:id (solo si nunca se usó) */
exports.deleteTipo = async (req, res) => {
  try {
    await deleteTipoCena(prisma, parseId(req));
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Error al eliminar el tipo de cena');
  }
};
