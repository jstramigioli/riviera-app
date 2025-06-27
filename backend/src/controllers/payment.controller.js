const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar todos los pagos
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        guest: {
          include: {
            reservation: {
              include: {
                room: true,
                mainClient: true
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching payments' });
  }
};

// Obtener pagos de un huésped específico
exports.getPaymentsByGuest = async (req, res) => {
  const { guestId } = req.params;
  try {
    const payments = await prisma.payment.findMany({
      where: { guestId: parseInt(guestId) },
      include: {
        guest: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching guest payments' });
  }
};

// Crear un nuevo pago o cargo
exports.createPayment = async (req, res) => {
  const { guestId, amount, type, description, date } = req.body;
  
  if (!guestId || !amount || !type || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['payment', 'charge'].includes(type)) {
    return res.status(400).json({ error: 'Type must be either "payment" or "charge"' });
  }

  try {
    const newPayment = await prisma.payment.create({
      data: {
        guestId: parseInt(guestId),
        amount: parseFloat(amount),
        type,
        description,
        date: date ? new Date(date) : new Date()
      },
      include: {
        guest: {
          include: {
            reservation: {
              include: {
                room: true,
                mainClient: true
              }
            }
          }
        }
      }
    });
    res.status(201).json(newPayment);
  } catch (error) {
    res.status(500).json({ error: 'Error creating payment', details: error.message });
  }
};

// Actualizar un pago
exports.updatePayment = async (req, res) => {
  const { id } = req.params;
  const { amount, type, description, date } = req.body;
  
  try {
    const updateData = {
      ...(amount && { amount: parseFloat(amount) }),
      ...(type && { type }),
      ...(description && { description }),
      ...(date && { date: new Date(date) })
    };

    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        guest: {
          include: {
            reservation: {
              include: {
                room: true,
                mainClient: true
              }
            }
          }
        }
      }
    });
    res.json(updatedPayment);
  } catch (error) {
    res.status(500).json({ error: 'Error updating payment', details: error.message });
  }
};

// Eliminar un pago
exports.deletePayment = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.payment.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting payment', details: error.message });
  }
};

// Crear cargo automático por reserva
exports.createReservationCharge = async (req, res) => {
  const { guestId, reservationId, amount, description } = req.body;
  
  if (!guestId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const newCharge = await prisma.payment.create({
      data: {
        guestId: parseInt(guestId),
        amount: parseFloat(amount),
        type: 'charge',
        description: description || `Cargo por reserva ${reservationId}`,
        date: new Date()
      },
      include: {
        guest: true
      }
    });
    res.status(201).json(newCharge);
  } catch (error) {
    res.status(500).json({ error: 'Error creating reservation charge', details: error.message });
  }
};

// Crear cargo por consumo
exports.createConsumptionCharge = async (req, res) => {
  const { guestId, amount, description } = req.body;
  
  if (!guestId || !amount || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const newCharge = await prisma.payment.create({
      data: {
        guestId: parseInt(guestId),
        amount: parseFloat(amount),
        type: 'charge',
        description,
        date: new Date()
      },
      include: {
        guest: true
      }
    });
    res.status(201).json(newCharge);
  } catch (error) {
    res.status(500).json({ error: 'Error creating consumption charge', details: error.message });
  }
}; 