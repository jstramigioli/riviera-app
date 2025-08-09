const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapeo de número de habitación a tipo (según tabla del usuario)
const roomTypeMap = {
  1: 'triple',
  2: 'doble',
  3: 'triple',
  5: 'cuadruple',
  6: 'cuadruple',
  7: 'doble',
  8: 'doble',
  9: 'doble',
  10: 'doble',
  11: 'triple',
  12: 'triple',
  13: 'triple',
  14: 'triple',
  15: 'triple',
  16: 'doble',
  17: 'triple',
  18: 'cuadruple',
  19: 'doble',
  21: 'doble',
  22: 'triple',
  23: 'doble',
  24: 'doble',
  25: 'doble',
  26: 'doble',
  27: 'doble',
  28: 'triple',
  29: 'doble',
  30: 'doble',
  31: 'single',
  32: 'single',
  33: 'triple',
  34: 'doble',
  35: 'triple',
  36: 'doble',
};

// Nombres de departamentos y su tipo
const departamentos = [
  { name: 'El Romerito', type: 'departamento El Romerito' },
  { name: 'El Tilo', type: 'departamento El Tilo' },
  { name: 'Via 1', type: 'departamento Via 1' },
  { name: 'La Esquinita', type: 'departamento La Esquinita' },
];

async function main() {
  // Crear los RoomType base
  const baseTypes = ['single', 'doble', 'triple', 'cuadruple'];
  const roomTypeRecords = {};
  for (const type of baseTypes) {
    roomTypeRecords[type] = await prisma.roomType.upsert({
      where: { name: type },
      update: {},
      create: { name: type },
    });
  }
  // Crear RoomType para cada departamento
  for (const depto of departamentos) {
    roomTypeRecords[depto.type] = await prisma.roomType.upsert({
      where: { name: depto.type },
      update: {},
      create: { name: depto.type },
    });
  }

  // Asignar roomTypeId a habitaciones numeradas
  for (const [num, type] of Object.entries(roomTypeMap)) {
    await prisma.room.updateMany({
      where: { name: num.toString() },
      data: { roomTypeId: roomTypeRecords[type].id },
    });
  }

  // Asignar roomTypeId a departamentos
  for (const depto of departamentos) {
    await prisma.room.updateMany({
      where: { name: depto.name },
      data: { roomTypeId: roomTypeRecords[depto.type].id },
    });
  }

  console.log('Migración de RoomType completada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 