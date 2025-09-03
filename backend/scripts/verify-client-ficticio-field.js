const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAndFixFicticioField() {
  try {
    console.log('🔍 Verificando campo esFicticio en clientes existentes...');
    
    // Contar clientes totales
    const totalClients = await prisma.client.count();
    console.log(`📊 Total de clientes en la base de datos: ${totalClients}`);
    
    // Contar clientes con esFicticio = true
    const fakeClients = await prisma.client.count({
      where: { esFicticio: true }
    });
    
    // Contar clientes con esFicticio = false
    const realClients = await prisma.client.count({
      where: { esFicticio: false }
    });
    
    // Contar clientes con esFicticio = null (si los hay)
    const nullFicticioClients = 0; // No puede ser null porque es Boolean con default false
    
    console.log('\n📋 Estado actual del campo esFicticio:');
    console.log(`   - Clientes reales (esFicticio = false): ${realClients}`);
    console.log(`   - Clientes ficticios (esFicticio = true): ${fakeClients}`);
    console.log(`   - Clientes con valor null: ${nullFicticioClients}`);
    
    // No hay clientes con valor null porque esFicticio es Boolean con default false
    if (nullFicticioClients > 0) {
      console.log('\n⚠️  Detectados clientes con esFicticio = null. Corrigiendo...');
      
      const updatedClients = await prisma.client.updateMany({
        where: { esFicticio: null },
        data: { esFicticio: false }
      });
      
      console.log(`✅ Se corrigieron ${updatedClients.count} clientes (esFicticio = false)`);
    }
    
    // Mostrar algunos ejemplos de clientes reales
    console.log('\n📋 Ejemplos de clientes reales:');
    const sampleRealClients = await prisma.client.findMany({
      where: { esFicticio: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        wantsPromotions: true
      },
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    sampleRealClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.firstName} ${client.lastName}`);
      console.log(`   📧 ${client.email || 'Sin email'}`);
      console.log(`   🏙️  ${client.city || 'Sin ciudad'}`);
      console.log(`   🎯 Promociones: ${client.wantsPromotions ? 'Sí' : 'No'}`);
      console.log('');
    });
    
    // Mostrar algunos ejemplos de clientes ficticios (si los hay)
    if (fakeClients > 0) {
      console.log('📋 Ejemplos de clientes ficticios:');
      const sampleFakeClients = await prisma.client.findMany({
        where: { esFicticio: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          city: true,
          wantsPromotions: true
        },
        take: 3,
        orderBy: { id: 'asc' }
      });
      
      sampleFakeClients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.firstName} ${client.lastName} (FICTICIO)`);
        console.log(`   📧 ${client.email || 'Sin email'}`);
        console.log(`   🏙️  ${client.city || 'Sin ciudad'}`);
        console.log(`   🎯 Promociones: ${client.wantsPromotions ? 'Sí' : 'No'}`);
        console.log('');
      });
    }
    
    console.log('✅ Verificación completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para mostrar estadísticas detalladas
async function showDetailedStats() {
  try {
    console.log('📊 Estadísticas detalladas de clientes...');
    
    // Estadísticas por provincia
    const clientsByProvince = await prisma.client.groupBy({
      by: ['province'],
      _count: {
        id: true
      },
      where: {
        province: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    console.log('\n🏛️  Clientes por provincia:');
    clientsByProvince.forEach(province => {
      console.log(`   - ${province.province}: ${province._count.id} clientes`);
    });
    
    // Estadísticas por promociones
    const clientsByPromotions = await prisma.client.groupBy({
      by: ['wantsPromotions'],
      _count: {
        id: true
      }
    });
    
    console.log('\n🎯 Clientes por preferencia de promociones:');
    clientsByPromotions.forEach(promo => {
      const status = promo.wantsPromotions ? 'Sí quieren promociones' : 'No quieren promociones';
      console.log(`   - ${status}: ${promo._count.id} clientes`);
    });
    
    // Estadísticas por tipo de documento
    const clientsByDocumentType = await prisma.client.groupBy({
      by: ['documentType'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    console.log('\n📄 Clientes por tipo de documento:');
    clientsByDocumentType.forEach(doc => {
      console.log(`   - ${doc.documentType}: ${doc._count.id} clientes`);
    });
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar según el argumento pasado
const action = process.argv[2];

switch (action) {
  case 'verify':
    verifyAndFixFicticioField();
    break;
  case 'stats':
    showDetailedStats();
    break;
  default:
    console.log('📖 Uso del script:');
    console.log('   node verify-client-ficticio-field.js verify  - Verificar y corregir campo esFicticio');
    console.log('   node verify-client-ficticio-field.js stats   - Mostrar estadísticas detalladas');
    process.exit(0);
} 