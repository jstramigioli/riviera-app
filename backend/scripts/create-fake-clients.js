const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Datos de clientes ficticios para testing
const fakeClients = [
  {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan.perez@test.com',
    phone: '+54 11 1234-5678',
    documentType: 'DNI',
    documentNumber: '12345678',
    country: 'Argentina',
    province: 'Buenos Aires',
    city: 'CABA',
    notes: 'Cliente ficticio para testing - Reservas frecuentes',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'María',
    lastName: 'González',
    email: 'maria.gonzalez@test.com',
    phone: '+54 11 2345-6789',
    documentType: 'DNI',
    documentNumber: '23456789',
    country: 'Argentina',
    province: 'Córdoba',
    city: 'Córdoba',
    notes: 'Cliente ficticio para testing - Prefiere habitaciones con vista',
    wantsPromotions: false,
    esFicticio: true
  },
  {
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    email: 'carlos.rodriguez@test.com',
    phone: '+54 11 3456-7890',
    documentType: 'DNI',
    documentNumber: '34567890',
    country: 'Argentina',
    province: 'Mendoza',
    city: 'Mendoza',
    notes: 'Cliente ficticio para testing - Viaja por trabajo',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'Ana',
    lastName: 'López',
    email: 'ana.lopez@test.com',
    phone: '+54 11 4567-8901',
    documentType: 'DNI',
    documentNumber: '45678901',
    country: 'Argentina',
    province: 'Santa Fe',
    city: 'Rosario',
    notes: 'Cliente ficticio para testing - Reservas familiares',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'Roberto',
    lastName: 'Martínez',
    email: 'roberto.martinez@test.com',
    phone: '+54 11 5678-9012',
    documentType: 'DNI',
    documentNumber: '56789012',
    country: 'Argentina',
    province: 'Tucumán',
    city: 'San Miguel de Tucumán',
    notes: 'Cliente ficticio para testing - Estancias largas',
    wantsPromotions: false,
    esFicticio: true
  },
  {
    firstName: 'Laura',
    lastName: 'Fernández',
    email: 'laura.fernandez@test.com',
    phone: '+54 11 6789-0123',
    documentType: 'DNI',
    documentNumber: '67890123',
    country: 'Argentina',
    province: 'Entre Ríos',
    city: 'Paraná',
    notes: 'Cliente ficticio para testing - Reservas de última hora',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'Diego',
    lastName: 'Sánchez',
    email: 'diego.sanchez@test.com',
    phone: '+54 11 7890-1234',
    documentType: 'DNI',
    documentNumber: '78901234',
    country: 'Argentina',
    province: 'Salta',
    city: 'Salta',
    notes: 'Cliente ficticio para testing - Prefiere habitaciones individuales',
    wantsPromotions: false,
    esFicticio: true
  },
  {
    firstName: 'Sofía',
    lastName: 'Torres',
    email: 'sofia.torres@test.com',
    phone: '+54 11 8901-2345',
    documentType: 'DNI',
    documentNumber: '89012345',
    country: 'Argentina',
    province: 'Chaco',
    city: 'Resistencia',
    notes: 'Cliente ficticio para testing - Reservas grupales',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'Miguel',
    lastName: 'Ramírez',
    email: 'miguel.ramirez@test.com',
    phone: '+54 11 9012-3456',
    documentType: 'DNI',
    documentNumber: '90123456',
    country: 'Argentina',
    province: 'Misiones',
    city: 'Posadas',
    notes: 'Cliente ficticio para testing - Estancias cortas',
    wantsPromotions: true,
    esFicticio: true
  },
  {
    firstName: 'Valentina',
    lastName: 'Castro',
    email: 'valentina.castro@test.com',
    phone: '+54 11 0123-4567',
    documentType: 'DNI',
    documentNumber: '01234567',
    country: 'Argentina',
    province: 'La Rioja',
    city: 'La Rioja',
    notes: 'Cliente ficticio para testing - Reservas de fin de semana',
    wantsPromotions: false,
    esFicticio: true
  }
];

async function createFakeClients() {
  try {
    console.log('🚀 Iniciando creación de clientes ficticios...');
    
    // Verificar si ya existen clientes ficticios
    const existingFakeClients = await prisma.client.count({
      where: { esFicticio: true }
    });
    
    if (existingFakeClients > 0) {
      console.log(`⚠️  Ya existen ${existingFakeClients} clientes ficticios en la base de datos.`);
      console.log('Continuando con la creación de clientes ficticios...');
    }
    
    // Crear los clientes ficticios
    const createdClients = [];
    
    for (const clientData of fakeClients) {
      const client = await prisma.client.create({
        data: clientData
      });
      createdClients.push(client);
      console.log(`✅ Cliente creado: ${client.firstName} ${client.lastName} (ID: ${client.id})`);
    }
    
    console.log(`\n🎉 Se crearon ${createdClients.length} clientes ficticios exitosamente!`);
    console.log('📊 Resumen:');
    console.log(`   - Total de clientes ficticios: ${createdClients.length}`);
    console.log(`   - Con promociones habilitadas: ${createdClients.filter(c => c.wantsPromotions).length}`);
    console.log(`   - Sin promociones: ${createdClients.filter(c => !c.wantsPromotions).length}`);
    
    // Mostrar algunos ejemplos
    console.log('\n📋 Ejemplos de clientes creados:');
    createdClients.slice(0, 3).forEach(client => {
      console.log(`   - ${client.firstName} ${client.lastName} (${client.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error al crear clientes ficticios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para limpiar clientes ficticios (útil para testing)
async function cleanFakeClients() {
  try {
    console.log('🧹 Limpiando clientes ficticios...');
    
    const deletedClients = await prisma.client.deleteMany({
      where: { esFicticio: true }
    });
    
    console.log(`✅ Se eliminaron ${deletedClients.count} clientes ficticios`);
    
  } catch (error) {
    console.error('❌ Error al limpiar clientes ficticios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para listar clientes ficticios
async function listFakeClients() {
  try {
    console.log('📋 Listando clientes ficticios...');
    
    const fakeClients = await prisma.client.findMany({
      where: { esFicticio: true },
              select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          city: true,
          wantsPromotions: true
        },
      orderBy: { id: 'asc' }
    });
    
    if (fakeClients.length === 0) {
      console.log('ℹ️  No hay clientes ficticios en la base de datos.');
      return;
    }
    
    console.log(`\n📊 Total de clientes ficticios: ${fakeClients.length}`);
    console.log('\n📋 Lista de clientes ficticios:');
    
    fakeClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.firstName} ${client.lastName}`);
      console.log(`   📧 ${client.email}`);
      console.log(`   📱 ${client.phone}`);
      console.log(`   🏙️  ${client.city}`);
      console.log(`   🎯 Promociones: ${client.wantsPromotions ? 'Sí' : 'No'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error al listar clientes ficticios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar según el argumento pasado
const action = process.argv[2];

switch (action) {
  case 'create':
    createFakeClients();
    break;
  case 'clean':
    cleanFakeClients();
    break;
  case 'list':
    listFakeClients();
    break;
  default:
    console.log('📖 Uso del script:');
    console.log('   node create-fake-clients.js create  - Crear clientes ficticios');
    console.log('   node create-fake-clients.js clean   - Eliminar clientes ficticios');
    console.log('   node create-fake-clients.js list    - Listar clientes ficticios');
    process.exit(0);
} 