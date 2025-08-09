const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Configuración de Google Sheets API
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Función para autenticar con Google Sheets
async function authenticateGoogleSheets() {
  try {
    // Verificar si existe el archivo de credenciales
    const credentialsPath = path.join(__dirname, 'credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Error: No se encontró el archivo credentials.json');
      console.log('📋 Para obtener las credenciales:');
      console.log('1. Ve a https://console.cloud.google.com/');
      console.log('2. Crea un nuevo proyecto o selecciona uno existente');
      console.log('3. Habilita la Google Sheets API');
      console.log('4. Crea credenciales de servicio');
      console.log('5. Descarga el archivo JSON y guárdalo como credentials.json en esta carpeta');
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('❌ Error al autenticar con Google Sheets:', error.message);
    return null;
  }
}

// Función para leer datos de Google Sheets
async function readGoogleSheet(sheets, spreadsheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values;
  } catch (error) {
    console.error('❌ Error al leer Google Sheets:', error.message);
    return null;
  }
}

// Función para mapear datos de Google Sheets a la estructura de Guest
function mapSheetDataToGuest(row, headers) {
  const guest = {};
  
  headers.forEach((header, index) => {
    const value = row[index] || '';
    
    switch (header.toLowerCase()) {
      case 'nombre':
      case 'firstname':
      case 'primer nombre':
        guest.firstName = value.trim();
        break;
      case 'apellido':
      case 'lastname':
      case 'primer apellido':
        guest.lastName = value.trim();
        break;
      case 'tipo documento':
      case 'documenttype':
      case 'tipo de documento':
        guest.documentType = value.trim() || 'DNI';
        break;
      case 'numero documento':
      case 'documentnumber':
      case 'dni':
      case 'pasaporte':
        guest.documentNumber = value.trim();
        break;
      case 'telefono':
      case 'phone':
      case 'teléfono':
        guest.phone = value.trim();
        break;
      case 'email':
      case 'correo':
      case 'correo electrónico':
        guest.email = value.trim();
        break;
      case 'direccion':
      case 'address':
      case 'dirección':
        guest.address = value.trim();
        break;
      case 'ciudad':
      case 'city':
        guest.city = value.trim();
        break;
    }
  });

  return guest;
}

// Función para validar datos del huésped
function validateGuest(guest) {
  const errors = [];
  
  if (!guest.firstName || guest.firstName.trim() === '') {
    errors.push('Nombre es requerido');
  }
  
  if (!guest.lastName || guest.lastName.trim() === '') {
    errors.push('Apellido es requerido');
  }

  if (guest.email && !isValidEmail(guest.email)) {
    errors.push('Email no válido');
  }

  return errors;
}

// Función para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para crear huéspedes en la base de datos
async function createGuests(guests) {
  const results = {
    created: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    
    try {
      // Validar datos
      const validationErrors = validateGuest(guest);
      if (validationErrors.length > 0) {
        results.errors.push({
          row: i + 2, // +2 porque la primera fila son headers y empezamos desde 0
          guest: `${guest.firstName} ${guest.lastName}`,
          errors: validationErrors
        });
        results.skipped++;
        continue;
      }

      // Verificar si el huésped ya existe (por documento o email)
      const existingGuest = await prisma.guest.findFirst({
        where: {
          OR: [
            {
              documentNumber: guest.documentNumber,
              documentType: guest.documentType
            },
            ...(guest.email ? [{ email: guest.email }] : [])
          ]
        }
      });

      if (existingGuest) {
        console.log(`⚠️  Huésped ya existe: ${guest.firstName} ${guest.lastName} (${guest.documentNumber})`);
        results.skipped++;
        continue;
      }

      // Crear el huésped
      await prisma.guest.create({
        data: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          documentType: guest.documentType,
          documentNumber: guest.documentNumber,
          phone: guest.phone,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          // Nota: reservationId es requerido, pero para migración podemos crear una reserva temporal
          // o modificar el esquema para hacerlo opcional
        }
      });

      console.log(`✅ Huésped creado: ${guest.firstName} ${guest.lastName}`);
      results.created++;

    } catch (error) {
      console.error(`❌ Error al crear huésped ${guest.firstName} ${guest.lastName}:`, error.message);
      results.errors.push({
        row: i + 2,
        guest: `${guest.firstName} ${guest.lastName}`,
        errors: [error.message]
      });
      results.skipped++;
    }
  }

  return results;
}

// Función principal de migración
async function migrateFromGoogleSheets(spreadsheetId, range = 'A:Z') {
  console.log('🚀 Iniciando migración desde Google Sheets...');
  
  // Autenticar con Google Sheets
  const sheets = await authenticateGoogleSheets();
  if (!sheets) {
    return;
  }

  // Leer datos de Google Sheets
  console.log('📖 Leyendo datos de Google Sheets...');
  const data = await readGoogleSheet(sheets, spreadsheetId, range);
  
  if (!data || data.length === 0) {
    console.error('❌ No se encontraron datos en Google Sheets');
    return;
  }

  // La primera fila contiene los headers
  const headers = data[0];
  const rows = data.slice(1);

  console.log(`📊 Encontrados ${rows.length} registros de huéspedes`);
  console.log('📋 Headers detectados:', headers.join(', '));

  // Mapear datos
  console.log('🔄 Mapeando datos...');
  const guests = rows.map(row => mapSheetDataToGuest(row, headers));

  // Crear huéspedes en la base de datos
  console.log('💾 Creando huéspedes en la base de datos...');
  const results = await createGuests(guests);

  // Mostrar resultados
  console.log('\n📈 Resultados de la migración:');
  console.log(`✅ Huéspedes creados: ${results.created}`);
  console.log(`⚠️  Huéspedes omitidos: ${results.skipped}`);
  
  if (results.errors.length > 0) {
    console.log(`❌ Errores encontrados: ${results.errors.length}`);
    console.log('\n📝 Detalles de errores:');
    results.errors.forEach(error => {
      console.log(`   Fila ${error.row}: ${error.guest} - ${error.errors.join(', ')}`);
    });
  }

  console.log('\n🎉 Migración completada!');
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🔧 Script de Migración desde Google Sheets

Uso:
  node google-sheets-migration.js <SPREADSHEET_ID> [RANGE]

Parámetros:
  SPREADSHEET_ID  - ID de la hoja de Google Sheets (obligatorio)
  RANGE           - Rango de celdas a leer (opcional, por defecto: A:Z)

Ejemplo:
  node google-sheets-migration.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms A1:Z1000

Configuración previa:
1. Crear credenciales de servicio en Google Cloud Console
2. Descargar el archivo JSON de credenciales
3. Guardarlo como 'credentials.json' en esta carpeta
4. Compartir la hoja de Google Sheets con la cuenta de servicio

Formato esperado de Google Sheets:
- Primera fila: Headers (Nombre, Apellido, DNI, Email, etc.)
- Filas siguientes: Datos de los huéspedes
- Headers soportados: nombre, apellido, dni, email, telefono, direccion, ciudad
  `);
}

// Ejecutar script
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const spreadsheetId = args[0];
  const range = args[1] || 'A:Z';

  try {
    await migrateFromGoogleSheets(spreadsheetId, range);
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = {
  migrateFromGoogleSheets,
  authenticateGoogleSheets,
  readGoogleSheet,
  mapSheetDataToGuest,
  validateGuest,
  createGuests
}; 