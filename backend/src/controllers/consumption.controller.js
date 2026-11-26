const prisma = require('../utils/prisma');
const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { CATEGORY_LABELS } = require('./menuItem.controller');
const {
  civilFromDb,
  isoDate,
  toDateOnlyUtc,
  todayIsoLocal
} = require('../utils/calendarDates');
const {
  ensureReservationAccount,
  dualWriteReservationRefs,
  dualWriteExternalRefs
} = require('../utils/accountHelpers');
const {
  AMBITO_LABELS,
  parseAmbito,
  buildComandaLines,
  refreshAccountStatus,
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
      if (ambito === 'FRIGOBAR') {
        return res.status(400).json({
          success: false,
          error: 'El frigobar solo se carga a cuentas de reserva'
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
    const lines = buildComandaLines(normalized, menuById);

    const { comanda, cargos: created } = await prisma.$transaction(async (tx) => {
      const comanda = await tx.comanda.create({
        data: {
          ambito,
          fecha: cargoFecha,
          accountId: account.id,
          reservationId: reservationId ?? account.reservationId ?? null,
          notas: notes
        }
      });

      const cargos = [];
      for (const line of lines) {
        const sub = subcatByCode.get(line.category);
        const cargo = await tx.cargo.create({
          data: {
            ...financialRefs,
            subcategoriaCargoId: sub.id,
            descripcion: line.descripcion,
            monto: line.subtotal,
            notas: notes,
            fecha: cargoFecha
          },
          include: { subcategoriaCargo: true }
        });
        await tx.comandaItem.create({
          data: {
            comandaId: comanda.id,
            menuItemId: line.menuItemId,
            varietyId: line.varietyId,
            descripcion: line.descripcion,
            cantidad: line.cantidad,
            precioUnitario: line.precioUnitario,
            subtotal: line.subtotal,
            cargoId: cargo.id
          }
        });
        cargos.push({
          ...cargo,
          comandaId: comanda.id,
          menuItemId: line.menuItemId,
          varietyId: line.varietyId,
          quantity: line.cantidad,
          unitPrice: line.precioUnitario
        });
      }

      await refreshAccountStatus(tx, account.id);
      return { comanda, cargos };
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
