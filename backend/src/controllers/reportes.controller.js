const prisma = require('../utils/prisma');
const { toDateOnlyUtc, isoDate, todayIsoLocal } = require('../utils/calendarDates');
const { aggregateVentas } = require('../utils/reporteVentas');

function parseFecha(raw) {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Ventas gastronómicas por ámbito y producto en un rango de fechas (de la comanda).
 * GET /api/reportes/ventas-gastronomia?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * Default: del 1° del mes actual a hoy (respeta fecha simulada).
 */
exports.getVentasGastronomia = async (req, res) => {
  try {
    const hoy = todayIsoLocal(req);
    const hasta = req.query.hasta ? parseFecha(req.query.hasta) : hoy;
    const desde = req.query.desde ? parseFecha(req.query.desde) : `${hoy.slice(0, 7)}-01`;
    if (!desde || !hasta) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas (YYYY-MM-DD)' });
    }
    if (desde > hasta) {
      return res.status(400).json({ success: false, error: 'La fecha desde es posterior a hasta' });
    }

    const items = await prisma.comandaItem.findMany({
      where: {
        comanda: {
          estado: 'ACTIVA',
          fecha: { gte: toDateOnlyUtc(desde), lte: toDateOnlyUtc(hasta) }
        }
      },
      select: {
        cantidad: true,
        subtotal: true,
        cargoId: true,
        bonificado: true,
        descripcion: true,
        menuItemId: true,
        varietyId: true,
        menuItem: { select: { name: true } },
        variety: { select: { name: true } },
        comanda: { select: { id: true, ambito: true } }
      }
    });

    res.json({
      success: true,
      data: { desde: isoDate(toDateOnlyUtc(desde)), hasta: isoDate(toDateOnlyUtc(hasta)), ...aggregateVentas(items) }
    });
  } catch (error) {
    console.error('Error en reporte de ventas gastronómicas:', error);
    res.status(500).json({ success: false, error: 'Error al generar el reporte', details: error.message });
  }
};
