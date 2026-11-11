const prisma = require('../utils/prisma');
const { aggregateReservationsBalance } = require('../utils/reservationBalance');

function normalizePlate(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().toUpperCase().replace(/\s+/g, '');
  return cleaned || null;
}

// Listar todos los clientes (incluye createdAt/updatedAt para comparaciones temporales)
exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching clients' });
  }
};

// Obtener un cliente específico
exports.getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching client' });
  }
};

// Crear un cliente
exports.createClient = async (req, res) => {
  const { firstName, lastName, email, phone, documentType, documentNumber, country, province, city, notes, vehiclePlate, wantsPromotions } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  
  // Validar formato de email si se proporciona
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const newClient = await prisma.client.create({
      data: { 
        firstName, 
        lastName, 
        email: email || null, 
        phone: phone || null, 
        documentType: documentType || 'DNI',
        documentNumber: documentNumber || null,
        country: country || null,
        province: province || null,
        city: city || null,
        notes: notes || null,
        vehiclePlate: normalizePlate(vehiclePlate),
        wantsPromotions: wantsPromotions || false
      }
    });
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      error: 'Error creating client',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};

// Actualizar un cliente
exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, documentType, documentNumber, country, province, city, notes, vehiclePlate, wantsPromotions } = req.body;
  
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  
  // Validar formato de email si se proporciona
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(documentType !== undefined && { documentType }),
        ...(documentNumber !== undefined && { documentNumber }),
        ...(country !== undefined && { country }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(notes !== undefined && { notes }),
        ...(vehiclePlate !== undefined && { vehiclePlate: normalizePlate(vehiclePlate) }),
        ...(wantsPromotions !== undefined && { wantsPromotions })
      }
    });
    res.json(updatedClient);
  } catch (error) {
    if (error.message && error.message.includes('Record not found')) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.status(500).json({ error: 'Error updating client', details: error.message });
  }
};

// Eliminar un cliente
exports.deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.client.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Client not found' });
  }
};

// Calcular balance de un cliente (misma fuente que resumen de reserva: cargos − pagos)
exports.getClientBalance = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        reservations: {
          include: {
            cargos: true,
            pagos: true,
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const aggregated = aggregateReservationsBalance(client.reservations);

    res.json({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      totalCharges: aggregated.totalCharges,
      totalPayments: aggregated.totalPayments,
      balance: aggregated.balance,
      isDebtor: aggregated.balance > 0,
      reservationCount: aggregated.reservationCount,
      reservations: aggregated.reservations,
    });
  } catch (error) {
    console.error('Error calculating client balance:', error);
    res.status(500).json({ error: 'Error calculating client balance' });
  }
}; 