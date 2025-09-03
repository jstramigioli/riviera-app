const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Datos de clientes ficticios con nombres únicos
const FAKE_CLIENTS_DATA = [
  { firstName: 'Test', lastName: 'Cliente1', email: 'test.cliente1@ficticio.com', phone: '+54 11 1111-1111', city: 'CABA' },
  { firstName: 'Test', lastName: 'Cliente2', email: 'test.cliente2@ficticio.com', phone: '+54 11 1111-1112', city: 'Córdoba' },
  { firstName: 'Test', lastName: 'Cliente3', email: 'test.cliente3@ficticio.com', phone: '+54 11 1111-1113', city: 'Mendoza' },
  { firstName: 'Test', lastName: 'Cliente4', email: 'test.cliente4@ficticio.com', phone: '+54 11 1111-1114', city: 'Rosario' },
  { firstName: 'Test', lastName: 'Cliente5', email: 'test.cliente5@ficticio.com', phone: '+54 11 1111-1115', city: 'Tucumán' },
  { firstName: 'Test', lastName: 'Cliente6', email: 'test.cliente6@ficticio.com', phone: '+54 11 1111-1116', city: 'Paraná' },
  { firstName: 'Test', lastName: 'Cliente7', email: 'test.cliente7@ficticio.com', phone: '+54 11 1111-1117', city: 'Salta' },
  { firstName: 'Test', lastName: 'Cliente8', email: 'test.cliente8@ficticio.com', phone: '+54 11 1111-1118', city: 'Resistencia' },
  { firstName: 'Test', lastName: 'Cliente9', email: 'test.cliente9@ficticio.com', phone: '+54 11 1111-1119', city: 'Posadas' },
  { firstName: 'Test', lastName: 'Cliente10', email: 'test.cliente10@ficticio.com', phone: '+54 11 1111-1120', city: 'La Rioja' },
  { firstName: 'Test', lastName: 'Cliente11', email: 'test.cliente11@ficticio.com', phone: '+54 11 1111-1121', city: 'Neuquén' },
  { firstName: 'Test', lastName: 'Cliente12', email: 'test.cliente12@ficticio.com', phone: '+54 11 1111-1122', city: 'Río Negro' },
  { firstName: 'Test', lastName: 'Cliente13', email: 'test.cliente13@ficticio.com', phone: '+54 11 1111-1123', city: 'Chubut' },
  { firstName: 'Test', lastName: 'Cliente14', email: 'test.cliente14@ficticio.com', phone: '+54 11 1111-1124', city: 'Santa Cruz' },
  { firstName: 'Test', lastName: 'Cliente15', email: 'test.cliente15@ficticio.com', phone: '+54 11 1111-1125', city: 'Tierra del Fuego' }
];

async function createSimpleFakeClients() {
  try {
    console.log('🚀 Creando clientes ficticios simples...');
    
    const createdClients = [];
    
    for (let i = 0; i < FAKE_CLIENTS_DATA.length; i++) {
      const clientData = FAKE_CLIENTS_DATA[i];
      
      try {
        const client = await prisma.client.create({
          data: {
            ...clientData,
            documentType: 'DNI',
            documentNumber: (Math.floor(Math.random() * 90000000) + 10000000).toString(),
            country: 'Argentina',
            province: 'Buenos Aires',
            notes: 'Cliente ficticio para testing - Generado automáticamente',
            wantsPromotions: Math.random() > 0.5,
            esFicticio: true
          }
        });
        
        createdClients.push(client);
        console.log(`✅ Cliente creado: ${client.firstName} ${client.lastName} (ID: ${client.id})`);
        
      } catch (error) {
        console.log(`❌ Error al crear cliente ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Se crearon ${createdClients.length} clientes ficticios exitosamente!`);
    
    if (createdClients.length > 0) {
      console.log('\n📋 Clientes creados:');
      createdClients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.firstName} ${client.lastName} (${client.email})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
createSimpleFakeClients(); 