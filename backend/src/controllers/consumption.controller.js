const prisma = require('../utils/prisma');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const {
  civilFromDb,
  isoDate,
  toDateOnlyUtc,
  todayIsoLocal
} = require('../utils/calendarDates');
const {
  ensureReservationAccount
} = require('../utils/accountHelpers');
const {
  AMBITO_LABELS,
  ComandaInputError,
  parseAmbito,
  resolveOrderItems,
  createComanda,
  addLinesToComanda,
  anularComanda
} = require('../utils/comandas');

function parseCivilDateParam(raw, req) {
  if (raw == null || raw === '') return todayIsoLocal(req);
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = toDateOnlyUtc(s);
  if (Number.isNaN(d.getTime())) return null;
  return isoDate(d);
}

function clientLastName(client) {
  if (!client) return '';
  return String(client.lastName || '').trim();
}

function clientDisplayName(client) {
  if (!client) return '';
  return `${client.firstName || ''} ${client.lastName || ''}`.trim();
}

function reservationLabel(roomName, lastName) {
  const room = roomName || 'Hab.';
  const apellido = lastName || 'Sin apellido';
  return `${room} - ${apellido}`;
}

/**
 * Reservas cuya estadía cubre la fecha (check-in y check-out inclusive).
 * Query: ?date=YYYY-MM-DD (default: hoy local).
 * Si el mismo día hay checkout de una e check-in de otra en la misma hab., salen ambas.
 */
exports.getOccupiedRoomsToday = async (req, res) => {
  try {
    const dateCivil = parseCivilDateParam(req.query.date ?? req.query.fecha, req);
    if (!dateCivil) {
      return res.status(400).json({
        success: false,
        error: 'date inválida; usá YYYY-MM-DD'
      });
    }

    const dayStart = toDateOnlyUtc(dateCivil);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const segments = await prisma.reservationSegment.findMany({
      where: {
        isActive: true,
        // Inclusive en ambos extremos del día civil (checkout + check-in el mismo día → ambas)
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
        reservation: {
          status: { in: OCCUPYING_STATUSES }
        }
      },
      include: {
        room: { select: { id: true, name: true, orderIndex: true } },
        reservation: {
          select: {
            id: true,
            status: true,
            mainClient: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: [{ room: { orderIndex: 'asc' } }, { room: { name: 'asc' } }]
    });

    const data = [];
    const seen = new Set();

    for (const seg of segments) {
      const startCivil = civilFromDb(seg.startDate);
      const endCivil = civilFromDb(seg.endDate);
      if (!startCivil || !endCivil) continue;
      if (startCivil > dateCivil || endCivil < dateCivil) continue;

      const reservationId = seg.reservation.id;
      const roomId = seg.roomId;
      const dedupeKey = `${reservationId}:${roomId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const lastName = clientLastName(seg.reservation.mainClient);
      const roomName = seg.room?.name || `Hab. ${roomId}`;

      data.push({
        roomId,
        roomName,
        reservationId,
        status: seg.reservation.status,
        clientId: seg.reservation.mainClient?.id || null,
        clientName: clientDisplayName(seg.reservation.mainClient),
        clientLastName: lastName,
        label: reservationLabel(roomName, lastName),
        segmentId: seg.id,
        startDate: startCivil,
        endDate: endCivil
      });
    }

    data.sort((a, b) => {
      const byRoom = String(a.roomName).localeCompare(String(b.roomName), 'es', {
        numeric: true
      });
      if (byRoom !== 0) return byRoom;
      return String(a.clientLastName).localeCompare(String(b.clientLastName), 'es');
    });

    res.json({
      success: true,
      data,
      count: data.length,
      date: dateCivil
    });
  } catch (error) {
    console.error('Error listando reservas ocupadas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar reservas ocupadas',
      details: error.message
    });
  }
};

/**
 * Carga una comanda de consumos sobre una reserva o cuenta externa.
 * Body: { ambito, reservationId?, accountId?, items: [...], fecha?: YYYY-MM-DD, notes? }
 * ambito: CENA | MINUTAS | CAFETERIA | FRIGOBAR (de toda la comanda).
 * Si viene reservationId → Account 1:1. Si accountId EXTERNAL → sin reserva.
 * Crea Comanda + líneas (precio histórico) + un Cargo por línea.
 */
exports.createConsumptionOrder = async (req, res) => {
  try {
    const reservationIdRaw = req.body.reservationId;
    const accountIdRaw = req.body.accountId;
    const reservationId =
      reservationIdRaw == null || reservationIdRaw === ''
        ? null
        : Number(reservationIdRaw);
    const accountId =
      accountIdRaw == null || accountIdRaw === '' ? null : Number(accountIdRaw);
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const fechaCivil = parseCivilDateParam(req.body.fecha ?? req.body.date, req);
    const ambito = parseAmbito(req.body.ambito);

    if (!ambito) {
      return res.status(400).json({
        success: false,
        error: 'Elegí el ámbito de la comanda (Cena, Minutas, Cafetería o Frigobar)'
      });
    }
    if (!fechaCivil) {
      return res.status(400).json({
        success: false,
        error: 'fecha inválida; usá YYYY-MM-DD'
      });
    }
    if (reservationId == null && accountId == null) {
      return res.status(400).json({
        success: false,
        error: 'Indicá reservationId o accountId'
      });
    }
    if (reservationId != null && !Number.isFinite(reservationId)) {
      return res.status(400).json({ success: false, error: 'reservationId inválido' });
    }
    if (accountId != null && !Number.isFinite(accountId)) {
      return res.status(400).json({ success: false, error: 'accountId inválido' });
    }
    if (rawItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Agregá al menos un ítem' });
    }

    let reservation = null;
    let account = null;
    let clientName = '';

    if (reservationId != null) {
      reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          mainClient: { select: { id: true, firstName: true, lastName: true } }
        }
      });
      if (!reservation) {
        return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
      }
      account = await ensureReservationAccount(prisma, reservationId, reservation.mainClientId);
      clientName = clientDisplayName(reservation.mainClient);
    } else {
      account = await prisma.account.findUnique({
        where: { id: accountId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } }
        }
      });
      if (!account) {
        return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
      }
      if (account.kind !== 'EXTERNAL') {
        return res.status(400).json({
          success: false,
          error: 'Para cuentas de reserva usá reservationId'
        });
      }
      if (ambito === 'FRIGOBAR') {
        return res.status(400).json({
          success: false,
          error: 'El frigobar solo se carga a cuentas de reserva'
        });
      }
      clientName = account.client
        ? clientDisplayName(account.client)
        : account.label || `Cuenta #${account.id}`;
    }

    let resolved;
    try {
      resolved = await resolveOrderItems(prisma, rawItems);
    } catch (err) {
      if (err instanceof ComandaInputError) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }

    const { comanda, cargos: created } = await prisma.$transaction((tx) =>
      createComanda(tx, {
        ambito,
        fecha: toDateOnlyUtc(fechaCivil),
        account,
        notas: notes,
        lines: resolved.lines,
        subcatByCode: resolved.subcatByCode
      })
    );

    const total = created.reduce(
      (sum, c) => sum + Number(c.monto),
      0
    );

    res.status(201).json({
      success: true,
      data: {
        accountId: account.id,
        accountKind: account.kind,
        comandaId: comanda.id,
        ambito,
        ambitoLabel: AMBITO_LABELS[ambito],
        reservationId: reservationId ?? account.reservationId ?? null,
        fecha: fechaCivil,
        clientName,
        cargos: created,
        total,
        count: created.length
      }
    });
  } catch (error) {
    console.error('Error creando comanda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar el consumo',
      details: error.message
    });
  }
};

/**
 * Anula una comanda completa: elimina sus cargos y la deja como registro.
 * POST /api/consumptions/orders/:id/anular
 */
exports.anularConsumptionOrder = async (req, res) => {
  try {
    const comandaId = Number(req.params.id);
    if (!Number.isInteger(comandaId) || comandaId <= 0) {
      return res.status(400).json({ success: false, error: 'id de comanda inválido' });
    }
    const comanda = await prisma.$transaction((tx) => anularComanda(tx, comandaId));
    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }
    res.json({ success: true, data: comanda });
  } catch (error) {
    console.error('Error anulando comanda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al anular la comanda',
      details: error.message
    });
  }
};

async function loadComandaWithAccount(db, comandaId) {
  return db.comanda.findUnique({
    where: { id: comandaId },
    include: {
      account: {
        include: { client: { select: { id: true, firstName: true, lastName: true } } }
      },
      reservation: {
        select: { id: true, mainClient: { select: { id: true, firstName: true, lastName: true } } }
      },
      items: { orderBy: { id: 'asc' } }
    }
  });
}

function comandaView(comanda) {
  const titular = comanda.reservation?.mainClient || comanda.account?.client || null;
  return {
    id: comanda.id,
    ambito: comanda.ambito,
    ambitoLabel: AMBITO_LABELS[comanda.ambito],
    estado: comanda.estado,
    fecha: isoDate(comanda.fecha),
    accountId: comanda.accountId,
    accountKind: comanda.account?.kind || null,
    accountLabel: comanda.account?.label || null,
    reservationId: comanda.reservationId,
    clientName: titular ? clientDisplayName(titular) : comanda.account?.label || null,
    notas: comanda.notas,
    items: comanda.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      varietyId: i.varietyId,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: Number(i.precioUnitario),
      subtotal: Number(i.subtotal),
      cargoId: i.cargoId
    })),
    total: comanda.items.reduce((sum, i) => sum + (i.cargoId ? Number(i.subtotal) : 0), 0)
  };
}

/** GET /api/consumptions/orders/:id */
exports.getConsumptionOrder = async (req, res) => {
  try {
    const comandaId = Number(req.params.id);
    if (!Number.isInteger(comandaId) || comandaId <= 0) {
      return res.status(400).json({ success: false, error: 'id de comanda inválido' });
    }
    const comanda = await loadComandaWithAccount(prisma, comandaId);
    if (!comanda) return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    res.json({ success: true, data: comandaView(comanda) });
  } catch (error) {
    console.error('Error obteniendo comanda:', error);
    res.status(500).json({ success: false, error: 'Error al obtener la comanda', details: error.message });
  }
};

/**
 * Agrega ítems a una comanda activa (mismo ámbito, cuenta y fecha).
 * POST /api/consumptions/orders/:id/items  Body: { items: [...] }
 */
exports.addItemsToConsumptionOrder = async (req, res) => {
  try {
    const comandaId = Number(req.params.id);
    if (!Number.isInteger(comandaId) || comandaId <= 0) {
      return res.status(400).json({ success: false, error: 'id de comanda inválido' });
    }
    const comanda = await loadComandaWithAccount(prisma, comandaId);
    if (!comanda) return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    if (comanda.estado !== 'ACTIVA') {
      return res.status(400).json({ success: false, error: 'La comanda está anulada' });
    }

    let resolved;
    try {
      resolved = await resolveOrderItems(prisma, req.body.items);
    } catch (err) {
      if (err instanceof ComandaInputError) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }

    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const cargos = await prisma.$transaction((tx) =>
      addLinesToComanda(tx, {
        comanda,
        account: comanda.account,
        lines: resolved.lines,
        subcatByCode: resolved.subcatByCode,
        notas: notes
      })
    );
    const updated = await loadComandaWithAccount(prisma, comandaId);
    res.status(201).json({
      success: true,
      data: {
        ...comandaView(updated),
        added: cargos.map((c) => ({ cargoId: c.id, comandaItemId: c.comandaItemId })),
        addedTotal: cargos.reduce((sum, c) => sum + Number(c.monto), 0)
      }
    });
  } catch (error) {
    console.error('Error agregando ítems a comanda:', error);
    res.status(500).json({ success: false, error: 'Error al agregar a la comanda', details: error.message });
  }
};
