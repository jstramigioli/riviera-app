const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar todos los clientes
exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching clients' });
  }
};

// Crear un cliente
exports.createClient = async (req, res) => {
  const { firstName, lastName, email, phone, documentType, documentNumber, notes } = req.body;
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
        email, 
        phone, 
        documentType: documentType || 'DNI',
        documentNumber,
        notes
      }
    });
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: 'Error creating client' });
  }
};

// Actualizar un cliente
exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, documentType, documentNumber, notes } = req.body;
  
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
        ...(email && { email }),
        ...(phone && { phone }),
        ...(documentType && { documentType }),
        ...(documentNumber && { documentNumber }),
        ...(notes !== undefined && { notes })
      }
    });
    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: 'Error updating client', details: error.message });
  }
};

// Calcular balance de un cliente
exports.getClientBalance = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        reservations: true
      }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Calcular total de cargos (reservas)
    const totalCharges = client.reservations
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + r.totalAmount, 0);

    // Por ahora asumimos que no hay pagos registrados para clientes
    // En el futuro esto se conectará con el sistema de pagos
    const totalPayments = 0;

    // Balance = cargos - pagos
    const balance = totalCharges - totalPayments;

    res.json({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      totalCharges,
      totalPayments,
      balance,
      isDebtor: balance > 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating client balance' });
  }
}; 