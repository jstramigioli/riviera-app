const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Función para leer archivo Excel
function readExcelFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Primera hoja
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    return data;
  } catch (error) {
    console.error('❌ Error al leer archivo Excel:', error.message);
    return null;
  }
}

// Función para analizar la estructura de datos
function analyzeDataStructure(data) {
  if (!data || data.length < 2) {
    console.error('❌ Datos insuficientes para analizar');
    return null;
  }

  const headers = data[0];
  const sampleRows = data.slice(1, Math.min(5, data.length)); // Primeras 5 filas como muestra

  console.log('📊 Análisis de estructura de datos:');
  console.log('====================================');
  console.log(`📋 Total de filas: ${data.length - 1}`);
  console.log(`📋 Total de columnas: ${headers.length}`);
  console.log('\n📋 Headers encontrados:');
  
  headers.forEach((header, index) => {
    console.log(`   ${index + 1}. "${header}"`);
  });

  console.log('\n📋 Muestra de datos (primeras filas):');
  sampleRows.forEach((row, index) => {
    console.log(`   Fila ${index + 2}:`, row);
  });

  return {
    headers,
    totalRows: data.length - 1,
    sampleRows
  };
}

// Función para mapear datos según la estructura real
function mapRowToGuest(row, headers, columnMapping) {
  const guest = {};
  
  headers.forEach((header, index) => {
    const value = row[index] || '';
    const mappedField = columnMapping[header];
    
    if (mappedField) {
      guest[mappedField] = value.toString().trim();
    }
  });

  return guest;
}

// Función para crear mapeo de columnas interactivo
function createColumnMapping(headers) {
  console.log('\n🔄 Creando mapeo de columnas...');
  console.log('================================');
  
  const mapping = {};
  const availableFields = [
    'firstName',
    'lastName', 
    'documentType',
    'documentNumber',
    'phone',
    'email',
    'address',
    'city'
  ];

  headers.forEach((header, index) => {
    console.log(`\n📋 Columna ${index + 1}: "${header}"`);
    console.log('Campos disponibles:');
    availableFields.forEach((field, fieldIndex) => {
      console.log(`   ${fieldIndex + 1}. ${field}`);
    });
    
    // Por ahora, intentar mapeo automático
    const autoMapping = autoMapColumn(header);
    if (autoMapping) {
      mapping[header] = autoMapping;
      console.log(`   ✅ Mapeo automático: ${autoMapping}`);
    } else {
      console.log(`   ⚠️  No se pudo mapear automáticamente`);
    }
  });

  return mapping;
}

// Función para mapeo automático de columnas
function autoMapColumn(header) {
  const headerLower = header.toLowerCase().trim();
  
  const mappings = {
    // Nombres
    'nombre': 'firstName',
    'firstname': 'firstName',
    'primer nombre': 'firstName',
    'name': 'firstName',
    
    // Apellidos
    'apellido': 'lastName',
    'lastname': 'lastName',
    'primer apellido': 'lastName',
    'surname': 'lastName',
    
    // Documentos
    'tipo documento': 'documentType',
    'documenttype': 'documentType',
    'tipo de documento': 'documentType',
    'dni': 'documentNumber',
    'pasaporte': 'documentNumber',
    'numero documento': 'documentNumber',
    'documentnumber': 'documentNumber',
    'numero de documento': 'documentNumber',
    
    // Contacto
    'telefono': 'phone',
    'phone': 'phone',
    'teléfono': 'phone',
    'celular': 'phone',
    'email': 'email',
    'correo': 'email',
    'correo electrónico': 'email',
    'e-mail': 'email',
    
    // Dirección
    'direccion': 'address',
    'address': 'address',
    'dirección': 'address',
    'domicilio': 'address',
    'ciudad': 'city',
    'city': 'city',
    'localidad': 'city'
  };

  return mappings[headerLower] || null;
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
          row: i + 2,
          guest: `${guest.firstName || 'N/A'} ${guest.lastName || 'N/A'}`,
          errors: validationErrors
        });
        results.skipped++;
        continue;
      }

      // Verificar si el huésped ya existe
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
          documentType: guest.documentType || 'DNI',
          documentNumber: guest.documentNumber,
          phone: guest.phone,
          email: guest.email,
          address: guest.address,
          city: guest.city
        }
      });

      console.log(`✅ Huésped creado: ${guest.firstName} ${guest.lastName}`);
      results.created++;

    } catch (error) {
      console.error(`❌ Error al crear huésped ${guest.firstName} ${guest.lastName}:`, error.message);
      results.errors.push({
        row: i + 2,
        guest: `${guest.firstName || 'N/A'} ${guest.lastName || 'N/A'}`,
        errors: [error.message]
      });
      results.skipped++;
    }
  }

  return results;
}

// Función principal de migración
async function migrateFromExcel(filePath) {
  console.log('🚀 Iniciando migración desde archivo Excel...');
  console.log(`📁 Archivo: ${filePath}`);
  
  // Leer archivo Excel
  console.log('\n📖 Leyendo archivo Excel...');
  const data = readExcelFile(filePath);
  
  if (!data) {
    return;
  }

  // Analizar estructura
  const structure = analyzeDataStructure(data);
  if (!structure) {
    return;
  }

  // Crear mapeo de columnas
  const columnMapping = createColumnMapping(structure.headers);
  
  console.log('\n📋 Mapeo de columnas creado:');
  Object.entries(columnMapping).forEach(([header, field]) => {
    console.log(`   "${header}" → ${field}`);
  });

  // Mapear datos
  console.log('\n🔄 Mapeando datos...');
  const guests = data.slice(1).map(row => mapRowToGuest(row, structure.headers, columnMapping));

  // Crear huéspedes en la base de datos
  console.log('\n💾 Creando huéspedes en la base de datos...');
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
🔧 Script de Migración desde Excel

Uso:
  node excel-migration.js <ARCHIVO_EXCEL>

Parámetros:
  ARCHIVO_EXCEL  - Ruta al archivo .xlsx (obligatorio)

Ejemplo:
  node excel-migration.js ./datos-pasajeros.xlsx

Formato esperado de Excel:
- Primera fila: Headers (Nombre, Apellido, DNI, Email, etc.)
- Filas siguientes: Datos de los huéspedes
- Headers soportados: nombre, apellido, dni, email, telefono, direccion, ciudad

El script analizará automáticamente la estructura y creará el mapeo de columnas.
  `);
}

// Ejecutar script
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const filePath = args[0];

  try {
    await migrateFromExcel(filePath);
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
  migrateFromExcel,
  readExcelFile,
  analyzeDataStructure,
  createColumnMapping,
  mapRowToGuest,
  validateGuest,
  createGuests
}; 