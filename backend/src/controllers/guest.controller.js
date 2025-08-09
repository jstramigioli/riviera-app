const prisma = require('../utils/prisma');

// Listar todos los huéspedes
exports.getAllGuests = async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      include: {
        reservation: {
          include: {
            room: true,
            mainClient: true
          }
        },
        payments: true
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
            room: true,
            mainClient: true
          }
        },
        payments: {
          orderBy: { date: 'desc' }
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

// Calcular balance de un huésped
exports.getGuestBalance = async (req, res) => {
  const { id } = req.params;
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: parseInt(id) },
      include: {
        payments: true
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Calcular total de cargos (reservas + consumos)
    const totalCharges = guest.payments
      .filter(p => p.type === 'charge')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calcular total de pagos
    const totalPayments = guest.payments
      .filter(p => p.type === 'payment')
      .reduce((sum, p) => sum + p.amount, 0);

    // Balance = cargos - pagos
    const balance = totalCharges - totalPayments;

    res.json({
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`,
      totalCharges,
      totalPayments,
      balance,
      isDebtor: balance > 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating guest balance' });
  }
}; 