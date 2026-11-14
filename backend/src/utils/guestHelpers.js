const { OCCUPYING_STATUSES } = require('../constants/reservationStatus');

/**
 * Snapshot Guest desde un Client (titular u otro de la agenda).
 */
function guestDataFromClient(client, reservationId) {
  if (!client) return null;
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    documentType: client.documentType || 'DNI',
    documentNumber: client.documentNumber || null,
    phone: client.phone || null,
    email: client.email || null,
    address: null,
    city: client.city || null,
    reservationId: reservationId != null ? parseInt(reservationId, 10) : null,
    clientId: client.id != null ? parseInt(client.id, 10) : null
  };
}

/**
 * Busca el Guest de la reserva vinculado al responsable (clientId = mainClientId).
 */
async function findHolderGuest(prisma, reservationId, mainClientId) {
  if (!reservationId || !mainClientId) return null;
  return prisma.guest.findFirst({
    where: {
      reservationId: parseInt(reservationId, 10),
      clientId: parseInt(mainClientId, 10)
    }
  });
}

/**
 * Crea Guest desde Client si no existe ya en la reserva (por clientId o documento).
 * @returns {Promise<object|null>} guest creado o existente; null si no hay client
 */
async function ensureGuestFromClient(prisma, reservationId, client, { force = false } = {}) {
  if (!client?.id || !reservationId) return null;
  const rid = parseInt(reservationId, 10);
  const cid = parseInt(client.id, 10);

  const existingByClient = await prisma.guest.findFirst({
    where: { reservationId: rid, clientId: cid }
  });
  if (existingByClient) return existingByClient;

  if (!force && client.documentNumber) {
    const doc = String(client.documentNumber).trim().toLowerCase();
    if (doc) {
      const guests = await prisma.guest.findMany({
        where: { reservationId: rid, documentNumber: { not: null } }
      });
      const match = guests.find(
        (g) => String(g.documentNumber || '').trim().toLowerCase() === doc
      );
      if (match) {
        if (!match.clientId) {
          return prisma.guest.update({
            where: { id: match.id },
            data: { clientId: cid }
          });
        }
        return match;
      }
    }
  }

  return prisma.guest.create({
    data: guestDataFromClient(client, rid)
  });
}

/**
 * Auto-incorpora al responsable como huésped (default al crear reserva).
 */
async function ensureHolderAsGuest(prisma, reservationId, mainClientId) {
  if (!reservationId || !mainClientId) return null;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(mainClientId, 10) }
  });
  if (!client) return null;
  return ensureGuestFromClient(prisma, reservationId, client);
}

/**
 * Capacidad máxima = max guestCount de segmentos activos.
 */
async function getReservationGuestCapacity(prisma, reservationId) {
  const segments = await prisma.reservationSegment.findMany({
    where: { reservationId: parseInt(reservationId, 10), isActive: true },
    select: { guestCount: true }
  });
  if (!segments.length) return null;
  return Math.max(...segments.map((s) => Number(s.guestCount) || 0), 0);
}

/**
 * ¿Esta persona (clientId o documento) ya es huésped en otra reserva con overlap?
 * No aplica a ser responsable — solo a filas Guest.
 */
async function findOverlappingGuestStay(prisma, {
  reservationId,
  clientId,
  documentNumber,
  excludeGuestId = null
}) {
  const rid = reservationId != null ? parseInt(reservationId, 10) : null;
  if (!rid) return null;

  const currentSegments = await prisma.reservationSegment.findMany({
    where: { reservationId: rid, isActive: true },
    select: { startDate: true, endDate: true }
  });
  if (!currentSegments.length) return null;

  const doc =
    documentNumber != null && String(documentNumber).trim()
      ? String(documentNumber).trim().toLowerCase()
      : null;
  const cid = clientId != null ? parseInt(clientId, 10) : null;
  if (!doc && !cid) return null;

  const orFilters = [];
  if (cid) orFilters.push({ clientId: cid });
  if (doc) orFilters.push({ documentNumber: { equals: documentNumber.trim(), mode: 'insensitive' } });

  const candidates = await prisma.guest.findMany({
    where: {
      AND: [
        { reservationId: { not: rid } },
        ...(excludeGuestId ? [{ id: { not: parseInt(excludeGuestId, 10) } }] : []),
        { OR: orFilters },
        {
          reservation: {
            status: { in: OCCUPYING_STATUSES },
            segments: { some: { isActive: true } }
          }
        }
      ]
    },
    include: {
      reservation: {
        select: {
          id: true,
          status: true,
          mainClientId: true,
          segments: {
            where: { isActive: true },
            select: { startDate: true, endDate: true, roomId: true }
          }
        }
      }
    }
  });

  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

  for (const guest of candidates) {
    const otherSegs = guest.reservation?.segments || [];
    for (const cur of currentSegments) {
      for (const other of otherSegs) {
        if (overlaps(cur.startDate, cur.endDate, other.startDate, other.endDate)) {
          return {
            guest,
            reservationId: guest.reservation.id,
            message: `Esta persona ya figura como huésped en la reserva #${guest.reservation.id} con fechas superpuestas`
          };
        }
      }
    }
  }
  return null;
}

module.exports = {
  guestDataFromClient,
  findHolderGuest,
  ensureGuestFromClient,
  ensureHolderAsGuest,
  getReservationGuestCapacity,
  findOverlappingGuestStay
};
