const prisma = require('../utils/prisma');
const { Decimal } = require('@prisma/client/runtime/library');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { CATEGORY_LABELS } = require('./menuItem.controller');
const { civilFromDb, isoDate, toDateOnlyUtc } = require('../utils/calendarDates');
const {
  ensureReservationAccount,
  dualWriteReservationRefs,
  dualWriteExternalRefs,
  syncAccountStatusFromBalance
} = require('../utils/accountHelpers');
const { calculateAccountBalance } = require('../utils/accountBalance');

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
 * Carga una comanda de consumos sobre una reserva o cuenta externa.
 * Body: { reservationId?, accountId?, items: [...], fecha?: YYYY-MM-DD, notes? }
 * Si viene reservationId → Account 1:1. Si accountId EXTERNAL → sin reserva.
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
    const fechaCivil = parseCivilDateParam(req.body.fecha ?? req.body.date);

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
    let financialRefs = null;
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
      financialRefs = dualWriteReservationRefs(account, reservationId);
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
      financialRefs = dualWriteExternalRefs(account);
      clientName = account.client
        ? clientDisplayName(account.client)
        : account.label || `Cuenta #${account.id}`;
    }

    const normalized = [];
    for (const row of rawItems) {
      const menuItemId = Number(row.menuItemId);
      const quantity = Number(row.quantity);
      const varietyIdRaw = row.varietyId ?? row.menuItemVarietyId;
      const varietyId =
        varietyIdRaw == null || varietyIdRaw === ''
          ? null
          : Number(varietyIdRaw);
      if (!Number.isFinite(menuItemId) || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Cada ítem necesita menuItemId y quantity > 0'
        });
      }
      if (varietyIdRaw != null && varietyIdRaw !== '' && !Number.isFinite(varietyId)) {
        return res.status(400).json({
          success: false,
          error: 'varietyId inválido'
        });
      }
      normalized.push({
        menuItemId,
        varietyId,
        quantity: Math.min(999, Math.floor(quantity))
      });
    }

    const menuIds = [...new Set(normalized.map((i) => i.menuItemId))];
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuIds }, isActive: true },
      include: {
        varieties: { orderBy: [{ ordenIndex: 'asc' }, { name: 'asc' }] }
      }
    });
    if (menuItems.length !== menuIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Uno o más ítems del menú no existen o están inactivos'
      });
    }
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    for (const row of normalized) {
      const item = menuById.get(row.menuItemId);
      const varieties = item.varieties || [];
      if (varieties.length > 0) {
        if (row.varietyId == null) {
          return res.status(400).json({
            success: false,
            error: `Elegí variedad para “${item.name}” (${varieties.map((v) => v.name).join(' / ')})`
          });
        }
        const variety = varieties.find((v) => v.id === row.varietyId);
        if (!variety) {
          return res.status(400).json({
            success: false,
            error: `Variedad inválida para “${item.name}”`
          });
        }
        row.variety = variety;
      } else if (row.varietyId != null) {
        return res.status(400).json({
          success: false,
          error: `“${item.name}” no tiene variedades`
        });
      }
    }

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
        const variety = row.variety || null;
        const unit = new Decimal(variety ? variety.price : item.price);
        const qty = row.quantity;
        const monto = unit.mul(qty);
        const label = variety ? `${item.name} (${variety.name})` : item.name;
        const descripcion = qty === 1 ? label : `${label} x${qty}`;

        const cargo = await tx.cargo.create({
          data: {
            ...financialRefs,
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
          varietyId: variety ? variety.id : null,
          varietyName: variety ? variety.name : null,
          quantity: qty,
          unitPrice: unit
        });
      }

      const [allCargos, allPagos] = await Promise.all([
        tx.cargo.findMany({ where: { accountId: account.id }, select: { monto: true } }),
        tx.pago.findMany({ where: { accountId: account.id }, select: { montoARS: true } })
      ]);
      const { saldo } = calculateAccountBalance(allCargos, allPagos);
      await syncAccountStatusFromBalance(tx, account.id, saldo);

      return cargos;
    });

    const total = created.reduce(
      (sum, c) => sum + Number(c.monto),
      0
    );

    res.status(201).json({
      success: true,
      data: {
        accountId: account.id,
        accountKind: account.kind,
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
