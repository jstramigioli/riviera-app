const prisma = require('../utils/prisma');

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

// Obtener una reserva específica
exports.getReservationById = async (req, res) => {
  const { id } = req.params;
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: {
        room: true,
        mainClient: true,
        guests: true
      }
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching reservation' });
  }
};

// Crear una reserva
exports.createReservation = async (req, res) => {
  const { roomId, mainClientId, guests, checkIn, checkOut, totalAmount, status, notes } = req.body;
  if (!roomId || !mainClientId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const newReservation = await prisma.reservation.create({
      data: {
        roomId,
        mainClientId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalAmount: totalAmount || 0,
        status: status || 'active',
        notes,
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
  const { roomId, mainClientId, checkIn, checkOut, totalAmount, status, reservationType, fixed, notes } = req.body;
  
  if (!roomId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const updateData = {
      roomId: parseInt(roomId),
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      ...(typeof fixed !== 'undefined' ? { fixed } : {}),
      ...(mainClientId && { mainClientId: parseInt(mainClientId) }),
      ...(totalAmount && { totalAmount: parseFloat(totalAmount) }),
      ...(status && { status }),
      ...(reservationType && { reservationType }),
      ...(notes !== undefined && { notes })
    };

    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: updateData,
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

// Eliminar una reserva
exports.deleteReservation = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.reservation.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Reservation not found' });
  }
};
