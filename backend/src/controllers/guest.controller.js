const prisma = require('../utils/prisma');
const { calculateReservationBalance } = require('../utils/reservationBalance');
const {
  ensureGuestFromClient,
  ensureHolderAsGuest,
  findHolderGuest,
  getReservationGuestCapacity,
  findOverlappingGuestStay
} = require('../utils/guestHelpers');

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

// Crear un nuevo huésped
exports.createGuest = async (req, res) => {
  const {
    firstName,
    lastName,
    documentType,
    documentNumber,
    phone,
    email,
    address,
    city,
    reservationId,
    clientId,
    skipOverlapCheck
  } = req.body;

  // Validaciones básicas
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }

  try {
    if (reservationId) {
      await assertCapacity(reservationId, 1);

      if (skipOverlapCheck !== true && skipOverlapCheck !== 'true') {
        const overlap = await findOverlappingGuestStay(prisma, {
          reservationId,
          clientId: clientId || null,
          documentNumber: documentNumber || null
        });
        if (overlap) {
          return res.status(409).json({
            error: overlap.message,
            conflictingReservationId: overlap.reservationId
          });
        }
      }
    }

    const newGuest = await prisma.guest.create({
      data: {
        firstName,
        lastName,
        documentType: documentType || 'DNI',
        documentNumber: documentNumber || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        reservationId: reservationId || null,
        clientId: clientId != null ? parseInt(clientId, 10) : null
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
    res.status(201).json(newGuest);
  } catch (error) {
    console.error('Error creating guest:', error);
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

// Actualizar un huésped
exports.updateGuest = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const current = await prisma.guest.findUnique({ where: { id: parseInt(id) } });
    if (!current) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const nextDoc = data.documentNumber !== undefined ? data.documentNumber : current.documentNumber;
    const nextClientId = data.clientId !== undefined ? data.clientId : current.clientId;

    if (current.reservationId && data.skipOverlapCheck !== true) {
      const overlap = await findOverlappingGuestStay(prisma, {
        reservationId: current.reservationId,
        clientId: nextClientId,
        documentNumber: nextDoc,
        excludeGuestId: current.id
      });
      if (overlap) {
        return res.status(409).json({
          error: overlap.message,
          conflictingReservationId: overlap.reservationId
        });
      }
    }

    const { skipOverlapCheck, ...updateData } = data;
    void skipOverlapCheck;

    const updatedGuest = await prisma.guest.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { client: true }
    });
    res.json(updatedGuest);
  } catch (error) {
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    res.status(500).json({ error: 'Error updating guest', details: error.message });
  }
};

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
