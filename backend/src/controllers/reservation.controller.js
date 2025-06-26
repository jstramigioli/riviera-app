const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar todas las reservas
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        room: true,
        mainClient: true,
        guests: true
      }
    });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching reservations' });
  }
};

// Crear una reserva
exports.createReservation = async (req, res) => {
  const { roomId, mainClientId, guests, checkIn, checkOut, totalAmount, status } = req.body;
  if (!roomId || !mainClientId || !checkIn || !checkOut || !totalAmount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const newReservation = await prisma.reservation.create({
      data: {
        roomId,
        mainClientId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalAmount,
        status: status || 'active',
        guests: {
          create: guests && Array.isArray(guests) ? guests.map(g => ({ firstName: g.firstName, lastName: g.lastName })) : []
        }
      },
      include: {
        room: true,
        mainClient: true,
        guests: true
      }
    });
    res.status(201).json(newReservation);
  } catch (error) {
    res.status(500).json({ error: 'Error creating reservation', details: error.message });
  }
};

// Actualizar una reserva
exports.updateReservation = async (req, res) => {
  const { id } = req.params;
  const { roomId, checkIn, checkOut, fixed } = req.body;
  
  if (!roomId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: {
        roomId: parseInt(roomId),
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        ...(typeof fixed !== 'undefined' ? { fixed } : {})
      },
      include: {
        room: true,
        mainClient: true,
        guests: true
      }
    });
    res.json(updatedReservation);
  } catch (error) {
    res.status(500).json({ error: 'Error updating reservation', details: error.message });
  }
};
