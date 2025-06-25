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
  const { firstName, lastName, email, phone, document } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  try {
    const newClient = await prisma.client.create({
      data: { firstName, lastName, email, phone, document }
    });
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: 'Error creating client' });
  }
}; 