const prisma = require('../utils/prisma');
const { civilFromDb, todayIsoLocal } = require('../utils/calendarDates');
const {
  DINING_SERVICE,
  DINING_STATUS,
  computeDiningAgenda,
  wouldDoubleCountMediaPension
} = require('../services/diningGuestsCompute');
const {
  ensureReservationAccount
} = require('../utils/accountHelpers');
const { NON_OCCUPYING_STATUSES } = require('../constants/reservationStatus');

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DINING_INCLUDE = {
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true
    }
  },
  reservation: {
    select: {
      id: true,
      status: true,
      source: true,
      mainClientId: true,
      account: { select: { id: true, kind: true, label: true, status: true } }
    }
  },
  account: {
    select: {
      id: true,
      kind: true,
      label: true,
      status: true,
      reservationId: true,
      clientId: true
    }
  }
};

function parseDayIso(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const iso = String(value).trim().slice(0, 10);
  return ISO_DAY_RE.test(iso) ? iso : null;
}

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOptionalInt(value) {
  if (value == null || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : NaN;
}

function civilDateUtc(dayIso) {
  const [y, m, d] = dayIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function serializeDining(row) {
  if (!row) return null;
  return {
    ...row,
    serviceDate: civilFromDb(row.serviceDate)
  };
}

async function loadServiceTypes() {
  return prisma.serviceType.findMany({
    select: { id: true, name: true, description: true }
  });
}

const LODGING_SEGMENT_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  guestCount: true,
  services: true,
  roomId: true,
  virtualRoomId: true,
  isActive: true
};

const LODGING_INCLUDE = {
  mainClient: {
    select: { id: true, firstName: true, lastName: true }
  },
  guests: { select: { id: true } },
  account: { select: { id: true } },
  segments: {
    where: { isActive: true },
    select: LODGING_SEGMENT_SELECT
  }
};

async function loadLodgingForDay(dayIso) {
  const day = civilDateUtc(dayIso);

  // Cargar reservas no canceladas con segmentos que puedan cubrir la noche.
  // Filtrado fino de noche half-open lo hace computeDiningAgenda.
  return prisma.reservation.findMany({
    where: {
      status: { notIn: NON_OCCUPYING_STATUSES },
      segments: {
        some: {
          isActive: true,
          startDate: { lte: day },
          endDate: { gt: day }
        }
      }
    },
    include: LODGING_INCLUDE
  });
}

async function findDuplicateActive({
  reservationId,
  serviceDate,
  serviceType,
  excludeId = null
}) {
  if (reservationId == null) return null;
  return prisma.diningReservation.findFirst({
    where: {
      reservationId,
      serviceDate: civilDateUtc(serviceDate),
      serviceType,
      status: DINING_STATUS.CONFIRMADA,
      ...(excludeId != null ? { id: { not: excludeId } } : {})
    }
  });
}

async function validateAccountLink(accountId, { clientId, reservationId }) {
  if (accountId == null) return { ok: true, account: null };
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return { ok: false, error: 'Cuenta no encontrada', status: 404 };
  }
  if (reservationId != null && account.kind === 'RESERVATION') {
    if (account.reservationId != null && account.reservationId !== reservationId) {
      return {
        ok: false,
        error: 'La cuenta no corresponde a la reserva de alojamiento indicada',
        status: 400
      };
    }
  }
  if (
    account.clientId != null &&
    clientId != null &&
    account.clientId !== clientId &&
    account.kind === 'EXTERNAL'
  ) {
    // Permitido: cuenta externa de otro titular; solo aviso soft — no bloquear.
  }
  return { ok: true, account };
}

/**
 * Agenda operativa: totales + desglose MP / adicionales / externos.
 * GET /api/dining-reservations/agenda?date=YYYY-MM-DD&serviceType=CENA
 */
async function getAgenda(req, res) {
  try {
    const dayIso = parseDayIso(req.query.date, todayIsoLocal(req));
    if (!dayIso) {
      return res.status(400).json({ error: 'Fecha inválida (yyyy-MM-dd)' });
    }
    const serviceType = String(req.query.serviceType || DINING_SERVICE.CENA).toUpperCase();
    if (serviceType !== DINING_SERVICE.CENA) {
      return res.status(400).json({ error: 'serviceType no soportado' });
    }

    const [lodgingReservations, diningReservations, serviceTypes] = await Promise.all([
      loadLodgingForDay(dayIso),
      prisma.diningReservation.findMany({
        where: {
          serviceDate: civilDateUtc(dayIso),
          serviceType
        },
        include: DINING_INCLUDE,
        orderBy: [{ status: 'asc' }, { id: 'asc' }]
      }),
      loadServiceTypes()
    ]);

    const agenda = computeDiningAgenda({
      dayIso,
      serviceType,
      lodgingReservations,
      diningReservations,
      serviceTypes
    });

    return res.json({
      ...agenda,
      list: [
        ...agenda.additional.map(serializeDiningEntry),
        ...agenda.external.map(serializeDiningEntry)
      ],
      diningReservations: diningReservations.map(serializeDining)
    });
  } catch (error) {
    console.error('getAgenda dining:', error);
    return res.status(500).json({ error: 'Error al calcular agenda de comedor' });
  }
}

function serializeDiningEntry(entry) {
  return entry;
}

/**
 * Listado CRUD (filtro por fecha / reserva / cliente / estado).
 */
async function listDiningReservations(req, res) {
  try {
    const where = {};
    const dayIso = parseDayIso(req.query.date);
    if (dayIso) where.serviceDate = civilDateUtc(dayIso);
    const reservationId = parseOptionalInt(req.query.reservationId);
    if (Number.isNaN(reservationId)) {
      return res.status(400).json({ error: 'reservationId inválido' });
    }
    if (reservationId != null) where.reservationId = reservationId;
    const clientId = parseOptionalInt(req.query.clientId);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'clientId inválido' });
    }
    if (clientId != null) where.clientId = clientId;
    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();
      if (![DINING_STATUS.CONFIRMADA, DINING_STATUS.CANCELADA].includes(status)) {
        return res.status(400).json({ error: 'status inválido' });
      }
      where.status = status;
    }
    if (req.query.serviceType) {
      where.serviceType = String(req.query.serviceType).toUpperCase();
    }

    const rows = await prisma.diningReservation.findMany({
      where,
      include: DINING_INCLUDE,
      orderBy: [{ serviceDate: 'desc' }, { id: 'desc' }]
    });
    return res.json(rows.map(serializeDining));
  } catch (error) {
    console.error('listDiningReservations:', error);
    return res.status(500).json({ error: 'Error al listar reservas de comedor' });
  }
}

async function getDiningReservation(req, res) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const row = await prisma.diningReservation.findUnique({
      where: { id },
      include: DINING_INCLUDE
    });
    if (!row) return res.status(404).json({ error: 'Reserva de comedor no encontrada' });
    return res.json(serializeDining(row));
  } catch (error) {
    console.error('getDiningReservation:', error);
    return res.status(500).json({ error: 'Error al obtener reserva de comedor' });
  }
}

async function createDiningReservation(req, res) {
  try {
    const body = req.body || {};
    const dayIso = parseDayIso(body.serviceDate);
    if (!dayIso) {
      return res.status(400).json({ error: 'serviceDate es requerido (yyyy-MM-dd)' });
    }
    const serviceType = String(body.serviceType || DINING_SERVICE.CENA).toUpperCase();
    if (serviceType !== DINING_SERVICE.CENA) {
      return res.status(400).json({ error: 'serviceType no soportado' });
    }

    const guestCount = parseInt(body.guestCount, 10);
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      return res.status(400).json({ error: 'guestCount debe ser un entero ≥ 1' });
    }

    const reservationId = parseOptionalInt(body.reservationId);
    if (Number.isNaN(reservationId)) {
      return res.status(400).json({ error: 'reservationId inválido' });
    }

    let clientId = parseOptionalInt(body.clientId);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'clientId inválido' });
    }

    let lodging = null;
    if (reservationId != null) {
      lodging = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: LODGING_INCLUDE
      });
      if (!lodging) {
        return res.status(404).json({ error: 'Reserva de alojamiento no encontrada' });
      }
      if (NON_OCCUPYING_STATUSES.includes(lodging.status)) {
        return res.status(400).json({
          error: 'No se puede vincular a una reserva de alojamiento cancelada o no presentada'
        });
      }
      if (clientId == null) {
        clientId = lodging.mainClientId;
      }
    }

    if (clientId == null) {
      return res.status(400).json({ error: 'clientId es requerido' });
    }
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const serviceTypes = await loadServiceTypes();
    if (
      lodging &&
      wouldDoubleCountMediaPension({
        reservation: lodging,
        dayIso,
        serviceTypes
      })
    ) {
      return res.status(409).json({
        error:
          'La reserva de alojamiento ya incluye cena por media pensión esa fecha. No crear reserva de comedor (evitar doble conteo).'
      });
    }

    const dup = await findDuplicateActive({
      reservationId,
      serviceDate: dayIso,
      serviceType
    });
    if (dup) {
      return res.status(409).json({
        error:
          'Ya existe una reserva de comedor confirmada para esa estadía, fecha y servicio',
        existingId: dup.id
      });
    }

    let accountId = parseOptionalInt(body.accountId);
    if (Number.isNaN(accountId)) {
      return res.status(400).json({ error: 'accountId inválido' });
    }

    // Default: folio de la estadía si no se indicó cuenta.
    if (accountId == null && reservationId != null) {
      const account = await ensureReservationAccount(
        prisma,
        reservationId,
        clientId
      );
      accountId = account.id;
    }

    const accountCheck = await validateAccountLink(accountId, {
      clientId,
      reservationId
    });
    if (!accountCheck.ok) {
      return res.status(accountCheck.status).json({ error: accountCheck.error });
    }

    const created = await prisma.diningReservation.create({
      data: {
        serviceDate: civilDateUtc(dayIso),
        serviceType,
        clientId,
        guestCount,
        reservationId,
        accountId,
        status: DINING_STATUS.CONFIRMADA,
        notes: body.notes != null ? String(body.notes).trim() || null : null
      },
      include: DINING_INCLUDE
    });

    return res.status(201).json(serializeDining(created));
  } catch (error) {
    console.error('createDiningReservation:', error);
    return res.status(500).json({ error: 'Error al crear reserva de comedor' });
  }
}

async function updateDiningReservation(req, res) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const existing = await prisma.diningReservation.findUnique({
      where: { id },
      include: {
        reservation: {
          include: LODGING_INCLUDE
        }
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Reserva de comedor no encontrada' });
    }

    const body = req.body || {};
    const data = {};

    if (body.serviceDate != null) {
      const dayIso = parseDayIso(body.serviceDate);
      if (!dayIso) {
        return res.status(400).json({ error: 'serviceDate inválida' });
      }
      data.serviceDate = civilDateUtc(dayIso);
    }

    if (body.serviceType != null) {
      const serviceType = String(body.serviceType).toUpperCase();
      if (serviceType !== DINING_SERVICE.CENA) {
        return res.status(400).json({ error: 'serviceType no soportado' });
      }
      data.serviceType = serviceType;
    }

    if (body.guestCount != null) {
      const guestCount = parseInt(body.guestCount, 10);
      if (!Number.isFinite(guestCount) || guestCount < 1) {
        return res.status(400).json({ error: 'guestCount debe ser un entero ≥ 1' });
      }
      data.guestCount = guestCount;
    }

    if (body.notes !== undefined) {
      data.notes =
        body.notes == null ? null : String(body.notes).trim() || null;
    }

    if (body.clientId != null) {
      const clientId = parsePositiveInt(body.clientId);
      if (!clientId) return res.status(400).json({ error: 'clientId inválido' });
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
      data.clientId = clientId;
    }

    let nextReservationId = existing.reservationId;
    if (body.reservationId !== undefined) {
      const reservationId = parseOptionalInt(body.reservationId);
      if (Number.isNaN(reservationId)) {
        return res.status(400).json({ error: 'reservationId inválido' });
      }
      nextReservationId = reservationId;
      data.reservationId = reservationId;
    }

    if (body.accountId !== undefined) {
      const accountId = parseOptionalInt(body.accountId);
      if (Number.isNaN(accountId)) {
        return res.status(400).json({ error: 'accountId inválido' });
      }
      data.accountId = accountId;
    }

    if (body.status != null) {
      const status = String(body.status).toUpperCase();
      if (![DINING_STATUS.CONFIRMADA, DINING_STATUS.CANCELADA].includes(status)) {
        return res.status(400).json({ error: 'status inválido' });
      }
      data.status = status;
    }

    const nextDayIso = civilFromDb(data.serviceDate || existing.serviceDate);
    const nextServiceType = data.serviceType || existing.serviceType;
    const nextStatus = data.status || existing.status;
    const nextClientId = data.clientId || existing.clientId;

    let lodging = existing.reservation;
    if (
      nextReservationId != null &&
      (nextReservationId !== existing.reservationId || !lodging)
    ) {
      lodging = await prisma.reservation.findUnique({
        where: { id: nextReservationId },
        include: LODGING_INCLUDE
      });
      if (!lodging) {
        return res.status(404).json({ error: 'Reserva de alojamiento no encontrada' });
      }
    }

    if (nextStatus === DINING_STATUS.CONFIRMADA && lodging) {
      const serviceTypes = await loadServiceTypes();
      if (
        wouldDoubleCountMediaPension({
          reservation: lodging,
          dayIso: nextDayIso,
          serviceTypes
        })
      ) {
        return res.status(409).json({
          error:
            'La reserva de alojamiento ya incluye cena por media pensión esa fecha. No crear reserva de comedor (evitar doble conteo).'
        });
      }

      const dup = await findDuplicateActive({
        reservationId: nextReservationId,
        serviceDate: nextDayIso,
        serviceType: nextServiceType,
        excludeId: id
      });
      if (dup) {
        return res.status(409).json({
          error:
            'Ya existe una reserva de comedor confirmada para esa estadía, fecha y servicio',
          existingId: dup.id
        });
      }
    }

    if (data.accountId !== undefined) {
      const accountCheck = await validateAccountLink(data.accountId, {
        clientId: nextClientId,
        reservationId: nextReservationId
      });
      if (!accountCheck.ok) {
        return res.status(accountCheck.status).json({ error: accountCheck.error });
      }
    }

    const updated = await prisma.diningReservation.update({
      where: { id },
      data,
      include: DINING_INCLUDE
    });
    return res.json(serializeDining(updated));
  } catch (error) {
    console.error('updateDiningReservation:', error);
    return res.status(500).json({ error: 'Error al actualizar reserva de comedor' });
  }
}

async function cancelDiningReservation(req, res) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const existing = await prisma.diningReservation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Reserva de comedor no encontrada' });
    }
    if (existing.status === DINING_STATUS.CANCELADA) {
      return res.json(serializeDining(existing));
    }
    const updated = await prisma.diningReservation.update({
      where: { id },
      data: { status: DINING_STATUS.CANCELADA },
      include: DINING_INCLUDE
    });
    return res.json(serializeDining(updated));
  } catch (error) {
    console.error('cancelDiningReservation:', error);
    return res.status(500).json({ error: 'Error al cancelar reserva de comedor' });
  }
}

module.exports = {
  getAgenda,
  listDiningReservations,
  getDiningReservation,
  createDiningReservation,
  updateDiningReservation,
  cancelDiningReservation,
  // testing
  _internal: {
    parseDayIso,
    civilDateUtc,
    serializeDining
  }
};
