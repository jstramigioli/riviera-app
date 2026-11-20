/**
 * Seed de usuarios de prueba (PGH-36).
 * Uso: node prisma/seed-users.js
 * Idempotente: actualiza password/rol/nombre si el username ya existe.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USERS = [
  {
    username: 'admin',
    displayName: 'Administrador',
    role: 'ADMIN',
    password: 'admin123'
  },
  {
    username: 'gerencia',
    displayName: 'Gerencia',
    role: 'GERENCIA',
    password: 'gerencia123'
  },
  {
    username: 'recepcion',
    displayName: 'Recepción',
    role: 'RECEPCION',
    password: 'recepcion123'
  }
];

async function upsertUser(entry) {
  const passwordHash = await bcrypt.hash(entry.password, 10);
  const username = entry.username.toLowerCase();

  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      displayName: entry.displayName,
      role: entry.role,
      passwordHash,
      isActive: true
    },
    update: {
      displayName: entry.displayName,
      role: entry.role,
      passwordHash,
      isActive: true
    }
  });

  return { username: user.username, role: user.role, password: entry.password };
}

async function main() {
  console.log('Seed usuarios de prueba...');
  const results = [];
  for (const entry of USERS) {
    results.push(await upsertUser(entry));
  }

  console.log('Usuarios listos:');
  for (const row of results) {
    console.log(`  - ${row.username} / ${row.password}  (${row.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
