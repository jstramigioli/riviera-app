const prisma = require('../utils/prisma');
const { civilFromDb, toDateOnlyUtc, isoDate, todayIsoLocal } = require('../utils/calendarDates');
const { GENERATING_STATUSES } = require('../utils/prestacionesComida');
const {
  ComidaInputError,
  registrarCenaManual,
  cancelarPrestacion,
  reactivarPrestacion,
  actualizarPrestacion
} = require('../utils/comidasGestion');
const { CenaInputError } = require('../utils/cenas');
const {
  BeneficioError,
  anularBeneficioManual,
  restaurarBeneficioManual
} = require('../utils/beneficios');

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
  const roomLabel = reservation ? roomLabelForNight(reservation.segments, night) : 'Externo';
  const guestName = reservation
    ? clientName(reservation.mainClient)
    : row.nombreExterno || row.comanda?.account?.label || 'Sin nombre';
  return {
    id: row.id,
    fecha,
    tipo: row.tipo,
    origen: row.origen,
    esExterno: !reservation,
    estado: row.estado,
    incluida: row.incluida,
    pax: row.pax,
    paxManual: row.paxManual,
    notas: row.notas,
    telefono: row.telefono,
    canceladaAt: row.canceladaAt,
    motivoCancelacion: row.motivoCancelacion,
    comandaId: row.comandaId,
    comandaEstado: row.comanda?.estado || null,
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
 * Comidas previstas de un día (vigentes). Por defecto solo las no canceladas;
 * con incluirCanceladas=1 también las canceladas (gestión de comensales).
 * Los totales cuentan solo las previstas.
 * GET /api/comidas?fecha=YYYY-MM-DD (default: hoy, respeta fecha simulada)
 */
exports.getComidasDelDia = async (req, res) => {
  try {
    const fecha = parseFecha(req.query.fecha ?? req.query.date, req);
    if (!fecha) {
      return res.status(400).json({ success: false, error: 'fecha inválida; usá YYYY-MM-DD' });
    }

    const incluirCanceladas = ['1', 'true'].includes(String(req.query.incluirCanceladas || ''));
    const rows = await prisma.prestacionComida.findMany({
      where: {
        fecha: toDateOnlyUtc(fecha),
        vigente: true,
        ...(incluirCanceladas ? {} : { estado: 'PREVISTA' })
      },
      include: {
        comanda: { select: { id: true, estado: true, account: { select: { label: true } } } },
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

    // Cenas manuales de reservas canceladas no cuentan (las de régimen ya se sincronizan).
    const items = rows
      .filter((r) => !r.reservation || GENERATING_STATUSES.has(r.reservation.status))
      .map(toItem)
      .sort(compareItems);
    const group = (tipo) => {
      const list = items.filter((i) => i.tipo === tipo);
      const total = list
        .filter((i) => i.estado === 'PREVISTA')
        .reduce((sum, i) => sum + i.pax, 0);
      return { total, items: list };
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

function handleError(res, error, fallback) {
  if (
    error instanceof ComidaInputError ||
    error instanceof CenaInputError ||
    error instanceof BeneficioError
  ) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback, details: error.message });
}

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ComidaInputError('id inválido');
  return id;
}

/** POST /api/comidas/cenas — cena no incluida (externo o huésped) + su comanda de Cena. */
exports.crearCenaManual = async (req, res) => {
  try {
    const { prestacion, comanda } = await registrarCenaManual(prisma, req.body || {});
    res.status(201).json({ success: true, data: { prestacion, comandaId: comanda.id } });
  } catch (error) {
    handleError(res, error, 'Error al registrar la cena');
  }
};

/** PATCH /api/comidas/:id — { pax?, notas? } */
exports.actualizarComida = async (req, res) => {
  try {
    res.json({ success: true, data: await actualizarPrestacion(prisma, parseId(req), req.body || {}) });
  } catch (error) {
    handleError(res, error, 'Error al actualizar la comida');
  }
};

/** POST /api/comidas/:id/cancelar — { motivo? } */
exports.cancelarComida = async (req, res) => {
  try {
    res.json({ success: true, data: await cancelarPrestacion(prisma, parseId(req), req.body || {}) });
  } catch (error) {
    handleError(res, error, 'Error al cancelar la comida');
  }
};

/** POST /api/comidas/:id/reactivar */
exports.reactivarComida = async (req, res) => {
  try {
    res.json({ success: true, data: await reactivarPrestacion(prisma, parseId(req)) });
  } catch (error) {
    handleError(res, error, 'Error al reactivar la comida');
  }
};

function beneficioView(b) {
  return {
    id: b.id,
    tipo: b.tipo,
    estado: b.estado,
    motivoAnulacion: b.motivoAnulacion,
    notas: b.notas,
    createdAt: b.createdAt,
    utilizadoAt: b.utilizadoAt,
    anuladoAt: b.anuladoAt,
    cenaFecha: b.prestacion ? civilFromDb(b.prestacion.fecha) : null,
    comanda: b.comanda
      ? {
          id: b.comanda.id,
          fecha: civilFromDb(b.comanda.fecha),
          estado: b.comanda.estado,
          items: b.comanda.items.map((i) => ({
            id: i.id,
            descripcion: i.descripcion,
            bonificado: i.bonificado,
            subtotal: Number(i.subtotal)
          }))
        }
      : null
  };
}

/**
 * Comidas y beneficios de una reserva (detalle de reserva → Comidas).
 * GET /api/comidas/reserva/:reservationId
 */
exports.getComidasDeReserva = async (req, res) => {
  try {
    const reservationId = Number(req.params.reservationId);
    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      throw new ComidaInputError('reserva inválida');
    }
    const [prestaciones, beneficios] = await Promise.all([
      prisma.prestacionComida.findMany({
        where: { reservationId, vigente: true },
        include: { beneficio: { select: { id: true, estado: true } } },
        orderBy: [{ fecha: 'asc' }, { tipo: 'asc' }]
      }),
      prisma.beneficioGastronomico.findMany({
        where: { reservationId },
        include: {
          prestacion: { select: { fecha: true } },
          comanda: {
            select: {
              id: true,
              fecha: true,
              estado: true,
              items: { orderBy: { id: 'asc' } }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    res.json({
      success: true,
      data: {
        reservationId,
        prestaciones: prestaciones.map((p) => ({
          id: p.id,
          fecha: civilFromDb(p.fecha),
          tipo: p.tipo,
          origen: p.origen,
          estado: p.estado,
          incluida: p.incluida,
          pax: p.pax,
          paxManual: p.paxManual,
          notas: p.notas,
          comandaId: p.comandaId,
          beneficio: p.beneficio
        })),
        beneficios: beneficios.map(beneficioView),
        beneficiosDisponibles: beneficios.filter((b) => b.estado === 'DISPONIBLE').length
      }
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las comidas de la reserva');
  }
};

/** POST /api/comidas/beneficios/:id/anular — { notas? } */
exports.anularBeneficio = async (req, res) => {
  try {
    res.json({ success: true, data: await anularBeneficioManual(prisma, parseId(req), req.body || {}) });
  } catch (error) {
    handleError(res, error, 'Error al anular el beneficio');
  }
};

/** POST /api/comidas/beneficios/:id/restaurar */
exports.restaurarBeneficio = async (req, res) => {
  try {
    res.json({ success: true, data: await restaurarBeneficioManual(prisma, parseId(req)) });
  } catch (error) {
    handleError(res, error, 'Error al restaurar el beneficio');
  }
};
