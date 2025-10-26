const prisma = require('../utils/prisma');

// Listar todos los huéspedes
exports.getAllGuests = async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      include: {
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
    reservationId
  } = req.body;

  // Validaciones básicas
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }

  try {
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
        reservationId: reservationId || null
      },
      include: {
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
    res.status(500).json({ error: 'Error creating guest', details: error.message });
  }
};

// Actualizar un huésped
exports.updateGuest = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const updatedGuest = await prisma.guest.update({
      where: { id: parseInt(id) },
      data
    });
    res.json(updatedGuest);
  } catch (error) {
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    res.status(500).json({ error: 'Error updating guest', details: error.message });
  }
};

// Eliminar un huésped
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

    res.json({ message: 'Guest deleted successfully' });
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
            pagos: true
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
        totalPayments: 0,
        balance: 0,
        isDebtor: false,
        message: 'Guest has no associated reservation'
      });
    }

    // Calcular total de cargos desde la reserva
    const totalCharges = guest.reservation.cargos.reduce((sum, cargo) => {
      return sum + parseFloat(cargo.monto);
    }, 0);

    // Calcular total de pagos desde la reserva (usando montoARS)
    const totalPayments = guest.reservation.pagos.reduce((sum, pago) => {
      return sum + parseFloat(pago.montoARS);
    }, 0);

    // Balance = cargos - pagos
    const balance = totalCharges - totalPayments;

    res.json({
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`,
      reservationId: guest.reservation.id,
      totalCharges,
      totalPayments,
      balance,
      isDebtor: balance > 0
    });
  } catch (error) {
    console.error('Error calculating guest balance:', error);
    res.status(500).json({ error: 'Error calculating guest balance', details: error.message });
  }
}; 