const {
  previewFakeReservations,
  generateFakeReservations,
  deleteFakeReservations,
  SCENARIOS,
  PACK_RECEPCION
} = require('../utils/fakeReservationFactory');

/**
 * Gate del generador DEBUG.
 * - true/1/yes → on
 * - false/0/no → off
 * - sin valor → on en local/dev (no production/test), para que el FAB
 *   no desaparezca cuando backend/.env pierde el flag tras merges.
 */
function isDebugEnabled() {
  const raw = String(process.env.ENABLE_DEBUG_FAKE_RESERVATIONS ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  return nodeEnv !== 'production' && nodeEnv !== 'test';
}

function requireDebugAdmin(req, res) {
  if (!isDebugEnabled()) {
    res.status(403).json({
      error: 'Debug deshabilitado',
      message: 'Definí ENABLE_DEBUG_FAKE_RESERVATIONS=true'
    });
    return false;
  }
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Solo ADMIN',
      message: 'Esta herramienta es solo para Admin'
    });
    return false;
  }
  return true;
}

function parseBody(req) {
  const body = req.body || {};
  return {
    today: body.today || req.query.today,
    from: body.from || body.dateFrom || req.query.from,
    to: body.to || body.dateTo || req.query.to,
    scenarios: body.scenarios,
    pack: body.pack || null,
    nights: body.nights,
    nightAmount: body.nightAmount,
    serviceTypeId: body.serviceTypeId,
    reuseClient: body.reuseClient,
    settleMode: body.settleMode
  };
}

async function meta(req, res, next) {
  try {
    if (!requireDebugAdmin(req, res)) return;
    res.json({
      enabled: true,
      scenarios: Object.keys(SCENARIOS),
      packs: ['recepcion', 'hotel_almost_full', 'hotel_full'],
      packRecepcion: PACK_RECEPCION
    });
  } catch (error) {
    next(error);
  }
}

async function preview(req, res, next) {
  try {
    if (!requireDebugAdmin(req, res)) return;
    const result = await previewFakeReservations(parseBody(req));
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error en preview' });
  }
}

async function generate(req, res, next) {
  try {
    if (!requireDebugAdmin(req, res)) return;
    const result = await generateFakeReservations(parseBody(req));
    res.status(201).json(result);
  } catch (error) {
    console.error('fake-reservations generate:', error);
    res.status(400).json({ error: error.message || 'Error al generar' });
  }
}

async function removeBatch(req, res, next) {
  try {
    if (!requireDebugAdmin(req, res)) return;
    const batchId = req.params.batchId;
    if (!batchId) {
      return res.status(400).json({ error: 'batchId requerido' });
    }
    const result = await deleteFakeReservations({ batchId });
    res.json(result);
  } catch (error) {
    console.error('fake-reservations delete batch:', error);
    res.status(500).json({ error: error.message || 'Error al limpiar lote' });
  }
}

async function removeAll(req, res, next) {
  try {
    if (!requireDebugAdmin(req, res)) return;
    const result = await deleteFakeReservations({});
    res.json(result);
  } catch (error) {
    console.error('fake-reservations delete all:', error);
    res.status(500).json({ error: error.message || 'Error al limpiar DEBUG' });
  }
}

module.exports = {
  meta,
  preview,
  generate,
  removeBatch,
  removeAll,
  isDebugEnabled
};
