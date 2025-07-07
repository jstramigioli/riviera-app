const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportDatabase() {
  try {
    console.log('🔄 Exportando datos de la base de datos...');
    
    // Crear directorio para los datos exportados
    const exportDir = path.join(__dirname, '../data');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Exportar cada modelo
    const models = [
      { name: 'tags', query: prisma.tag.findMany() },
      { name: 'roomTypes', query: prisma.roomType.findMany() },
      { name: 'rooms', query: prisma.room.findMany({ include: { tags: true } }) },
      { name: 'clients', query: prisma.client.findMany() },
      { name: 'guests', query: prisma.guest.findMany() },
      { name: 'payments', query: prisma.payment.findMany() },
      { name: 'reservations', query: prisma.reservation.findMany({ 
        include: { 
          guests: true,
          room: { include: { tags: true } },
          mainClient: true
        } 
      }) },
      { name: 'dailyRates', query: prisma.dailyRate.findMany() }
    ];

    const modelStats = [];

    for (const model of models) {
      console.log(`📦 Exportando ${model.name}...`);
      const data = await model.query;
      
      const filePath = path.join(exportDir, `${model.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      console.log(`✅ ${model.name}: ${data.length} registros exportados`);
      modelStats.push({ name: model.name, count: data.length });
    }

    // Crear archivo de metadatos
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalRecords: modelStats.reduce((acc, stat) => acc + stat.count, 0),
      models: modelStats
    };

    fs.writeFileSync(
      path.join(exportDir, 'metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );

    console.log('🎉 Exportación completada exitosamente!');
    console.log(`📁 Los datos se guardaron en: ${exportDir}`);

  } catch (error) {
    console.error('❌ Error durante la exportación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  exportDatabase();
}

module.exports = { exportDatabase }; 