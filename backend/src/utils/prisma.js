const { PrismaClient } = require('@prisma/client');
const { createAuditExtension } = require('../audit/prismaExtension');

const basePrisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

basePrisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

basePrisma.$on('warn', (e) => {
  console.warn('Prisma warn:', e);
});

/** Cliente con auditoría automática de mutaciones. */
const prisma = basePrisma.$extends(createAuditExtension(basePrisma));

module.exports = prisma;
module.exports.basePrisma = basePrisma;
