const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { CATEGORY_LABELS } = require('./menuItem.controller');

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function clientDisplayName(client) {
  if (!client) return '';
  return `${client.firstName || ''} ${client.lastName || ''}`.trim();
}

/** Habitaciones con huésped ocupando hoy (para selector de comanda). */
exports.getOccupiedRoomsToday = async (req, res) => {
  try {
    const dayStart = startOfLocalDay();
    const dayEnd = endOfLocalDay();

    const segments = await prisma.reservationSegment.findMany({
      where: {
        isActive: true,
        startDate: { lte: dayEnd },
        endDate: { gt: dayStart },
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

    // Preferir INGRESADA si hay varias reservas en la misma habitación
    const byRoom = new Map();
    for (const seg of segments) {
      const roomId = seg.roomId;
      const candidate = {
        roomId,
        roomName: seg.room?.name || `Hab. ${roomId}`,
        reservationId: seg.reservation.id,
        status: seg.reservation.status,
        clientId: seg.reservation.mainClient?.id || null,
        clientName: clientDisplayName(seg.reservation.mainClient),
        segmentId: seg.id,
        startDate: seg.startDate,
        endDate: seg.endDate
      };

      const prev = byRoom.get(roomId);
      if (!prev) {
        byRoom.set(roomId, candidate);
        continue;
      }
      if (prev.status !== 'INGRESADA' && candidate.status === 'INGRESADA') {
        byRoom.set(roomId, candidate);
      }
    }

    const data = [...byRoom.values()].sort((a, b) =>
      String(a.roomName).localeCompare(String(b.roomName), 'es', { numeric: true })
    );

    res.json({ success: true, data, count: data.length, date: dayStart.toISOString() });
  } catch (error) {
    console.error('Error listando habitaciones ocupadas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar habitaciones ocupadas',
      details: error.message
    });
  }
};

/**
 * Carga una comanda de consumos sobre una reserva.
 * Body: { reservationId, items: [{ menuItemId, quantity }], notes? }
 */
exports.createConsumptionOrder = async (req, res) => {
  try {
    const reservationId = Number(req.body.reservationId);
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

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
            fecha: new Date()
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
