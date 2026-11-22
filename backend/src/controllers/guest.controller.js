const prisma = require('../utils/prisma');
const { calculateReservationBalance } = require('../utils/reservationBalance');
const {
  ensureGuestFromClient,
  ensureHolderAsGuest,
  findHolderGuest,
  getReservationGuestCapacity,
  findOverlappingGuestStay
} = require('../utils/guestHelpers');
const { getAddressFromNotes } = require('../utils/clientAddressNotes');
const {
  normalizeText,
  buildIdentityKey,
  resolveClientIdentity
} = require('../services/resolveClientIdentity');

/** Campos de Guest (tabla) vs perfil Client. */
function guestTableFields(body = {}) {
  const identity = buildIdentityKey(body);
  return {
    firstName: normalizeText(body.firstName),
    lastName: normalizeText(body.lastName),
    documentType: identity.documentType,
    documentNumber: identity.documentNumber,
    documentIssuingCountry: identity.documentIssuingCountry,
    phone: normalizeText(body.phone),
    email: normalizeText(body.email),
    address: normalizeText(body.address),
    city: normalizeText(body.city)
  };
}

/**
 * Misma lógica que check-in externo: match por tipo+país emisor+nro normalizado.
 */
async function upsertClientForGuest(guestOrNull, body, existingClientId = null) {
  const preferred =
    existingClientId != null
      ? parseInt(existingClientId, 10)
      : guestOrNull?.clientId != null
        ? parseInt(guestOrNull.clientId, 10)
        : body.clientId != null
          ? parseInt(body.clientId, 10)
          : null;

  const resolution = await prisma.$transaction(async (tx) =>
    resolveClientIdentity(tx, body, {
      preferredClientId: Number.isFinite(preferred) ? preferred : null
    })
  );
  return {
    clientId: resolution.client.id,
    needsManualReview: resolution.needsManualReview,
    identityConflictNote: resolution.identityConflictNote,
    client: resolution.client
  };
}

// Listar todos los huéspedes
exports.getAllGuests = async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      include: {
        client: true,
        reservation: {
          include: {
            mainClient: true,
            segments: {
              include: {
                room: true
              }
            }
          }
        }
      }
    });
    res.json(guests);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching guests' });
  }
};

// Obtener un huésped por ID
exports.getGuestById = async (req, res) => {
  const { id } = req.params;
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: true,
        reservation: {
          include: {
            mainClient: true,
            segments: {
              include: {
                room: true
              }
            }
          }
        }
      }
    });
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    res.json(guest);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching guest' });
  }
};

async function assertCapacity(reservationId, extra = 1) {
  const capacity = await getReservationGuestCapacity(prisma, reservationId);
  if (capacity == null) return;
  const current = await prisma.guest.count({
    where: { reservationId: parseInt(reservationId, 10) }
  });
  if (current + extra > capacity) {
    const err = new Error(
      `La reserva admite hasta ${capacity} huésped${capacity === 1 ? '' : 'es'} (capacidad de la habitación)`
    );
    err.status = 400;
    throw err;
  }
}

// Crear un nuevo huésped (+ perfil Client, mismos campos que check-in)
exports.createGuest = async (req, res) => {
  const body = req.body || {};
  const {
    reservationId,
    clientId,
    skipOverlapCheck,
    syncClient = true
  } = body;
  const fields = guestTableFields(body);

  if (!fields.firstName || !fields.lastName) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }

  try {
    let linkedClientId = clientId != null ? parseInt(clientId, 10) : null;

    if (reservationId) {
      await assertCapacity(reservationId, 1);

      if (skipOverlapCheck !== true && skipOverlapCheck !== 'true') {
        const overlap = await findOverlappingGuestStay(prisma, {
          reservationId,
          clientId: linkedClientId,
          documentNumber: fields.documentNumber
        });
        if (overlap) {
          return res.status(409).json({
            error: overlap.message,
            conflictingReservationId: overlap.reservationId
          });
        }
      }
    }

    let resolveMeta = null;
    if (syncClient !== false && syncClient !== 'false') {
      resolveMeta = await upsertClientForGuest(null, body, linkedClientId);
      linkedClientId = resolveMeta.clientId;
    }

    const newGuest = await prisma.guest.create({
      data: {
        ...fields,
        reservationId: reservationId || null,
        clientId: linkedClientId
      },
      include: {
        client: true,
        reservation: {
          include: {
            mainClient: true
          }
        }
      }
    });
    res.status(201).json({
      ...newGuest,
      needsManualReview: Boolean(resolveMeta?.needsManualReview),
      identityConflictNote: resolveMeta?.identityConflictNote || null
    });
  } catch (error) {
    console.error('Error creating guest:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Ya existe un cliente con ese tipo, país emisor y número de documento'
      });
    }
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error creating guest', details: error.message });
  }
};

/**
 * Incorpora al responsable de la reserva como huésped (si aún no lo es).
 * POST /guests/from-holder  { reservationId }
 */
exports.addHolderAsGuest = async (req, res) => {
  const { reservationId } = req.body || {};
  if (!reservationId) {
    return res.status(400).json({ error: 'reservationId es requerido' });
  }
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId, 10) },
      select: { id: true, mainClientId: true }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const existing = await findHolderGuest(prisma, reservation.id, reservation.mainClientId);
    if (existing) {
      return res.json(existing);
    }

    await assertCapacity(reservation.id, 1);

    const overlap = await findOverlappingGuestStay(prisma, {
      reservationId: reservation.id,
      clientId: reservation.mainClientId
    });
    if (overlap) {
      return res.status(409).json({
        error: overlap.message,
        conflictingReservationId: overlap.reservationId
      });
    }

    const guest = await ensureHolderAsGuest(prisma, reservation.id, reservation.mainClientId);
    res.status(201).json(guest);
  } catch (error) {
    console.error('Error addHolderAsGuest:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error al incorporar responsable como huésped' });
  }
};

/**
 * Crea huésped desde un Client de la agenda.
 * POST /guests/from-client  { reservationId, clientId }
 */
exports.addGuestFromClient = async (req, res) => {
  const { reservationId, clientId } = req.body || {};
  if (!reservationId || !clientId) {
    return res.status(400).json({ error: 'reservationId y clientId son requeridos' });
  }
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId, 10) }
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const existing = await prisma.guest.findFirst({
      where: {
        reservationId: parseInt(reservationId, 10),
        clientId: parseInt(clientId, 10)
      }
    });
    if (existing) {
      return res.json(existing);
    }

    await assertCapacity(reservationId, 1);

    const overlap = await findOverlappingGuestStay(prisma, {
      reservationId,
      clientId,
      documentNumber: client.documentNumber
    });
    if (overlap) {
      return res.status(409).json({
        error: overlap.message,
        conflictingReservationId: overlap.reservationId
      });
    }

    const guest = await ensureGuestFromClient(prisma, reservationId, client);
    res.status(201).json(guest);
  } catch (error) {
    console.error('Error addGuestFromClient:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error al agregar huésped desde cliente' });
  }
};

// Actualizar un huésped (+ sincroniza Client si syncClient)
exports.updateGuest = async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  try {
    const current = await prisma.guest.findUnique({ where: { id: parseInt(id, 10) } });
    if (!current) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const fields = guestTableFields({
      firstName: data.firstName !== undefined ? data.firstName : current.firstName,
      lastName: data.lastName !== undefined ? data.lastName : current.lastName,
      documentType: data.documentType !== undefined ? data.documentType : current.documentType,
      documentNumber:
        data.documentNumber !== undefined ? data.documentNumber : current.documentNumber,
      documentIssuingCountry:
        data.documentIssuingCountry !== undefined
          ? data.documentIssuingCountry
          : current.documentIssuingCountry,
      phone: data.phone !== undefined ? data.phone : current.phone,
      email: data.email !== undefined ? data.email : current.email,
      address: data.address !== undefined ? data.address : current.address,
      city: data.city !== undefined ? data.city : current.city,
      birthDate: data.birthDate,
      country: data.country,
      province: data.province,
      wantsPromotions: data.wantsPromotions
    });

    let nextClientId =
      data.clientId !== undefined
        ? data.clientId != null
          ? parseInt(data.clientId, 10)
          : null
        : current.clientId;

    if (current.reservationId && data.skipOverlapCheck !== true) {
      const overlap = await findOverlappingGuestStay(prisma, {
        reservationId: current.reservationId,
        clientId: nextClientId,
        documentNumber: fields.documentNumber,
        excludeGuestId: current.id
      });
      if (overlap) {
        return res.status(409).json({
          error: overlap.message,
          conflictingReservationId: overlap.reservationId
        });
      }
    }

    let resolveMeta = null;
    const syncClient = data.syncClient !== false && data.syncClient !== 'false';
    if (syncClient) {
      resolveMeta = await upsertClientForGuest(current, { ...data, ...fields }, nextClientId);
      nextClientId = resolveMeta.clientId;
    }

    const updatedGuest = await prisma.guest.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...fields,
        clientId: nextClientId
      },
      include: { client: true }
    });
    res.json({
      ...updatedGuest,
      needsManualReview: Boolean(resolveMeta?.needsManualReview),
      identityConflictNote: resolveMeta?.identityConflictNote || null
    });
  } catch (error) {
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Ya existe un cliente con ese tipo, país emisor y número de documento'
      });
    }
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error updating guest', details: error.message });
  }
};

/** Helper exportado para prefill staff (dirección desde notes del client). */
exports.getAddressFromNotes = getAddressFromNotes;

// Eliminar un huésped (incluye al titular-huésped; no afecta mainClientId)
exports.deleteGuest = async (req, res) => {
  const { id } = req.params;
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    await prisma.guest.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'Guest deleted successfully',
      removedHolderGuest: Boolean(guest.clientId)
    });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Error deleting guest', details: error.message });
  }
};

// Calcular balance de un huésped (basado en la reserva asociada)
exports.getGuestBalance = async (req, res) => {
  const { id } = req.params;
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: parseInt(id) },
      include: {
        reservation: {
          include: {
            cargos: true,
            cobros: true
          }
        }
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    if (!guest.reservation) {
      return res.json({
        guestId: guest.id,
        guestName: `${guest.firstName} ${guest.lastName}`,
        totalCharges: 0,
        totalCobros: 0,
        balance: 0,
        isDebtor: false,
        message: 'Guest has no associated reservation'
      });
    }

    const { totalCargos, totalCobros, saldo } = calculateReservationBalance(
      guest.reservation.cargos,
      guest.reservation.cobros
    );

    res.json({
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`,
      reservationId: guest.reservation.id,
      totalCharges: totalCargos,
      totalCobros: totalCobros,
      balance: saldo,
      isDebtor: saldo > 0
    });
  } catch (error) {
    console.error('Error calculating guest balance:', error);
    res.status(500).json({ error: 'Error calculating guest balance', details: error.message });
  }
};
