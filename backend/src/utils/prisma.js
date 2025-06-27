const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Manejo de errores de conexión
prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

prisma.$on('disconnect', () => {
  console.log('Prisma disconnected');
});

module.exports = prisma; 