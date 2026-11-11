const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { CATEGORY_LABELS } = require('./menuItem.controller');
const { civilFromDb, isoDate, toDateOnlyUtc } = require('../utils/calendarDates');

function todayCivil() {
  const now = new Date();
  return isoDate(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  );
}

function parseCivilDateParam(raw) {
  if (raw == null || raw === '') return todayCivil();
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
    const dateCivil = parseCivilDateParam(req.query.date ?? req.query.fecha);
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
 * Carga una comanda de consumos sobre una reserva.
 * Body: { reservationId, items: [{ menuItemId, quantity }], fecha?: YYYY-MM-DD, notes? }
 * Cada cargo usa Cargo.fecha (propiedad del consumo).
 */
exports.createConsumptionOrder = async (req, res) => {
  try {
    const reservationId = Number(req.body.reservationId);
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const fechaCivil = parseCivilDateParam(req.body.fecha ?? req.body.date);

    if (!fechaCivil) {
      return res.status(400).json({
        success: false,
        error: 'fecha inválida; usá YYYY-MM-DD'
      });
    }
    if (!Number.isFinite(reservationId)) {
      return res.status(400).json({ success: false, error: 'reservationId inválido' });
    }
    if (rawItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Agregá al menos un ítem' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        mainClient: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const normalized = [];
    for (const row of rawItems) {
      const menuItemId = Number(row.menuItemId);
      const quantity = Number(row.quantity);
      if (!Number.isFinite(menuItemId) || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Cada ítem necesita menuItemId y quantity > 0'
        });
      }
      normalized.push({
        menuItemId,
        quantity: Math.min(999, Math.floor(quantity))
      });
    }

    const menuIds = [...new Set(normalized.map((i) => i.menuItemId))];
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuIds }, isActive: true }
    });
    if (menuItems.length !== menuIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Uno o más ítems del menú no existen o están inactivos'
      });
    }
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    const categories = [...new Set(menuItems.map((m) => m.category))];
    const subcats = await prisma.subcategoriaCargo.findMany({
      where: {
        tipo: 'CONSUMO',
        codigo: { in: categories },
        esActivo: true
      }
    });
    const subcatByCode = new Map(subcats.map((s) => [s.codigo, s]));

    for (const code of categories) {
      if (!subcatByCode.has(code)) {
        return res.status(400).json({
          success: false,
          error: `Falta subcategoría de consumo ${CATEGORY_LABELS[code] || code}. Configurala en Cargos.`
        });
      }
    }

    const cargoFecha = toDateOnlyUtc(fechaCivil);

    const created = await prisma.$transaction(async (tx) => {
      const cargos = [];
      for (const row of normalized) {
        const item = menuById.get(row.menuItemId);
        const sub = subcatByCode.get(item.category);
        const unit = new Decimal(item.price);
        const qty = row.quantity;
        const monto = unit.mul(qty);
        const descripcion =
          qty === 1 ? item.name : `${item.name} x${qty}`;

        const cargo = await tx.cargo.create({
          data: {
            reservaId: reservationId,
            subcategoriaCargoId: sub.id,
            descripcion,
            monto,
            notas: notes,
            fecha: cargoFecha
          },
          include: { subcategoriaCargo: true }
        });
        cargos.push({
          ...cargo,
          menuItemId: item.id,
          quantity: qty,
          unitPrice: unit
        });
      }
      return cargos;
    });

    const total = created.reduce(
      (sum, c) => sum + Number(c.monto),
      0
    );

    res.status(201).json({
      success: true,
      data: {
        reservationId,
        fecha: fechaCivil,
        clientName: clientDisplayName(reservation.mainClient),
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
