const prisma = require('../utils/prisma');
const { civilFromDb, toDateOnlyUtc, isoDate, todayIsoLocal } = require('../utils/calendarDates');

function parseFecha(raw, req) {
  if (raw == null || raw === '') return todayIsoLocal(req);
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = toDateOnlyUtc(s);
  return Number.isNaN(d.getTime()) ? null : isoDate(d);
}

function addDaysIso(iso, days) {
  const d = toDateOnlyUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function clientName(client) {
  if (!client) return 'Sin nombre';
  return `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Sin nombre';
}

/** Habitación(es) de la noche a la que corresponde la comida. */
function roomLabelForNight(segments, nightIso) {
  const labels = [];
  for (const seg of segments || []) {
    if (seg.isActive === false) continue;
    const start = civilFromDb(seg.startDate);
    const end = civilFromDb(seg.endDate);
    if (!(start <= nightIso && nightIso < end)) continue;
    const label = seg.virtualRoom?.name || seg.room?.name || (seg.roomId != null ? String(seg.roomId) : null);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.length ? labels.join('/') : '—';
}

function toItem(row) {
  const fecha = civilFromDb(row.fecha);
  // El desayuno corresponde a la noche anterior; la cena, a la noche del día.
  const night = row.tipo === 'DESAYUNO' ? addDaysIso(fecha, -1) : fecha;
  const reservation = row.reservation;
  const roomLabel = reservation ? roomLabelForNight(reservation.segments, night) : '—';
  const guestName = reservation ? clientName(reservation.mainClient) : 'Sin nombre';
  return {
    id: row.id,
    fecha,
    tipo: row.tipo,
    origen: row.origen,
    estado: row.estado,
    incluida: row.incluida,
    pax: row.pax,
    reservationId: row.reservationId,
    reservationStatus: reservation?.status || null,
    clientId: reservation?.mainClient?.id ?? null,
    guestName,
    roomLabel,
    label: `${roomLabel} - ${guestName} (${row.pax})`
  };
}

function compareItems(a, b) {
  return (
    String(a.roomLabel).localeCompare(String(b.roomLabel), 'es', { numeric: true }) ||
    String(a.guestName).localeCompare(String(b.guestName), 'es')
  );
}

/**
 * Comidas previstas de un día (solo vigentes y no canceladas).
 * GET /api/comidas?fecha=YYYY-MM-DD (default: hoy, respeta fecha simulada)
 */
exports.getComidasDelDia = async (req, res) => {
  try {
    const fecha = parseFecha(req.query.fecha ?? req.query.date, req);
    if (!fecha) {
      return res.status(400).json({ success: false, error: 'fecha inválida; usá YYYY-MM-DD' });
    }

    const rows = await prisma.prestacionComida.findMany({
      where: { fecha: toDateOnlyUtc(fecha), vigente: true, estado: 'PREVISTA' },
      include: {
        reservation: {
          select: {
            id: true,
            status: true,
            mainClient: { select: { id: true, firstName: true, lastName: true } },
            segments: {
              select: {
                startDate: true,
                endDate: true,
                isActive: true,
                roomId: true,
                room: { select: { name: true } },
                virtualRoom: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    const items = rows.map(toItem).sort(compareItems);
    const group = (tipo) => {
      const list = items.filter((i) => i.tipo === tipo);
      return { total: list.reduce((sum, i) => sum + i.pax, 0), items: list };
    };

    res.json({
      success: true,
      data: { fecha, desayunos: group('DESAYUNO'), cenas: group('CENA') }
    });
  } catch (error) {
    console.error('Error listando comidas del día:', error);
    res.status(500).json({ success: false, error: 'Error al listar comidas', details: error.message });
  }
};
