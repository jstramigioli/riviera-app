const { migrateFromGoogleSheets } = require('./google-sheets-migration');

// Ejemplo de uso del script de migración
async function runExampleMigration() {
  console.log('📋 Ejemplo de migración desde Google Sheets');
  console.log('=============================================\n');

  // Reemplaza estos valores con los tuyos
  const spreadsheetId = 'TU_SPREADSHEET_ID_AQUI';
  const range = 'A1:Z1000'; // Ajusta según tus datos

  console.log('🔧 Configuración:');
  console.log(`   Spreadsheet ID: ${spreadsheetId}`);
  console.log(`   Rango: ${range}`);
  console.log('\n📋 Asegúrate de:');
  console.log('   1. Tener el archivo credentials.json en esta carpeta');
  console.log('   2. Haber compartido la hoja con la cuenta de servicio');
  console.log('   3. Que la primera fila contenga los headers');
  console.log('\n🚀 Ejecutando migración...\n');

  try {
    await migrateFromGoogleSheets(spreadsheetId, range);
  } catch (error) {
    console.error('❌ Error en la migración de ejemplo:', error.message);
  }
}

// Ejecutar ejemplo
if (require.main === module) {
  runExampleMigration();
} 