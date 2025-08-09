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

    console.log(`📖 Leyendo archivo: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON manteniendo los headers
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
  const sampleRows = data.slice(1, Math.min(3, data.length));

  console.log('\n📊 Análisis de estructura de datos:');
  console.log('====================================');
  console.log(`📋 Total de filas: ${data.length - 1}`);
  console.log(`📋 Total de columnas: ${headers.length}`);
  
  console.log('\n📋 Headers encontrados:');
  headers.forEach((header, index) => {
    console.log(`   ${index + 1}. "${header}"`);
  });

  console.log('\n📋 Muestra de datos (primeras filas):');
  sampleRows.forEach((row, index) => {
    console.log(`   Fila ${index + 2}:`, row.slice(0, 10)); // Mostrar solo las primeras 10 columnas
  });

  return {
    headers,
    totalRows: data.length - 1,
    sampleRows
  };
}

// Función para extraer clientes de una fila (principal + acompañantes)
function extractClientsFromRow(row, headers) {
  const clients = [];
  
  // Buscar patrones de columnas para identificar clientes principales y acompañantes
  const clientPatterns = [];
  
  // Analizar headers para encontrar patrones de clientes
  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase();
    
    // Detectar si es una columna de cliente principal
    if (headerLower.includes('nombre') || headerLower.includes('apellido') || headerLower.includes('dni')) {
      // Buscar si hay múltiples columnas con el mismo patrón (acompañantes)
      const basePattern = headerLower.replace(/\d+$/, ''); // Remover números al final
      
      if (!clientPatterns.find(p => p.basePattern === basePattern)) {
        clientPatterns.push({
          basePattern,
          columns: []
        });
      }
      
      const pattern = clientPatterns.find(p => p.basePattern === basePattern);
      pattern.columns.push({
        header,
        index,
        type: headerLower.includes('nombre') ? 'nombre' : 
              headerLower.includes('apellido') ? 'apellido' : 
              headerLower.includes('dni') ? 'dni' : 'otro'
      });
    }
  });

  console.log('\n🔍 Patrones de clientes detectados:');
  clientPatterns.forEach((pattern, index) => {
    console.log(`   Cliente ${index + 1}:`, pattern.columns.map(c => c.header).join(', '));
  });

  // Extraer clientes basado en los patrones
  clientPatterns.forEach((pattern, clientIndex) => {
    const client = {
      isMain: clientIndex === 0, // El primer patrón es el cliente principal
      firstName: '',
      lastName: '',
      documentNumber: '',
      documentType: 'DNI',
      phone: '',
      email: '',
      address: '',
      city: '',
      registrationDate: null
    };

    // Buscar columnas específicas para este cliente
    pattern.columns.forEach(col => {
      const value = row[col.index] || '';
      
      switch (col.type) {
        case 'nombre':
          client.firstName = value.toString().trim();
          break;
        case 'apellido':
          client.lastName = value.toString().trim();
          break;
        case 'dni':
          client.documentNumber = value.toString().trim();
          break;
      }
    });

    // Buscar información adicional (teléfono, email, etc.) que puede estar en columnas separadas
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      const value = row[index] || '';
      
      if (client.isMain) { // Solo para el cliente principal
        if (headerLower.includes('telefono') || headerLower.includes('teléfono') || headerLower.includes('phone')) {
          client.phone = value.toString().trim();
        } else if (headerLower.includes('email') || headerLower.includes('correo')) {
          client.email = value.toString().trim();
        } else if (headerLower.includes('direccion') || headerLower.includes('dirección') || headerLower.includes('address')) {
          client.address = value.toString().trim();
        } else if (headerLower.includes('ciudad') || headerLower.includes('city')) {
          client.city = value.toString().trim();
        } else if (headerLower.includes('fecha') || headerLower.includes('date')) {
          // Intentar parsear fecha
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              client.registrationDate = date;
            }
          } catch (e) {
            // Ignorar errores de fecha
          }
        }
      }
    });

    // Solo agregar si tiene al menos nombre y apellido
    if (client.firstName && client.lastName) {
      clients.push(client);
    }
  });

  return clients;
}

// Función para validar cliente
function validateClient(client) {
  const errors = [];
  
  if (!client.firstName || client.firstName.trim() === '') {
    errors.push('Nombre es requerido');
  }
  
  if (!client.lastName || client.lastName.trim() === '') {
    errors.push('Apellido es requerido');
  }

  if (client.email && !isValidEmail(client.email)) {
    errors.push('Email no válido');
  }

  return errors;
}

// Función para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para crear o actualizar clientes en la base de datos
async function processClients(allClients) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Agrupar clientes por DNI para manejar duplicados
  const clientsByDNI = {};
  
  allClients.forEach((client, index) => {
    if (client.documentNumber) {
      if (!clientsByDNI[client.documentNumber]) {
        clientsByDNI[client.documentNumber] = [];
      }
      clientsByDNI[client.documentNumber].push({
        ...client,
        originalIndex: index
      });
    }
  });

  console.log(`\n📊 Procesando ${allClients.length} clientes...`);
  console.log(`📊 Clientes únicos por DNI: ${Object.keys(clientsByDNI).length}`);

  // Procesar cada grupo de DNI
  for (const [dni, clients] of Object.entries(clientsByDNI)) {
    try {
      if (clients.length === 1) {
        // Cliente único, crear nuevo
        const client = clients[0];
        const validationErrors = validateClient(client);
        
        if (validationErrors.length > 0) {
          results.errors.push({
            dni,
            client: `${client.firstName} ${client.lastName}`,
            errors: validationErrors
          });
          results.skipped++;
          continue;
        }

        // Verificar si ya existe en la base de datos
        const existingClient = await prisma.client.findFirst({
          where: {
            OR: [
              { documentNumber: dni },
              ...(client.email ? [{ email: client.email }] : [])
            ]
          }
        });

        if (existingClient) {
          console.log(`⚠️  Cliente ya existe en BD: ${client.firstName} ${client.lastName} (${dni})`);
          results.skipped++;
          continue;
        }

        // Crear nuevo cliente
        await prisma.client.create({
          data: {
            firstName: client.firstName,
            lastName: client.lastName,
            documentType: client.documentType,
            documentNumber: client.documentNumber,
            phone: client.phone,
            email: client.email,
            notes: client.isMain ? 'Cliente principal' : 'Acompañante'
          }
        });

        console.log(`✅ Cliente creado: ${client.firstName} ${client.lastName} (${client.isMain ? 'Principal' : 'Acompañante'})`);
        results.created++;

      } else {
        // Múltiples registros con el mismo DNI
        console.log(`🔄 Procesando duplicados para DNI ${dni} (${clients.length} registros)`);
        
        // Ordenar por fecha de registro (más antigua primero)
        clients.sort((a, b) => {
          if (!a.registrationDate && !b.registrationDate) return 0;
          if (!a.registrationDate) return 1;
          if (!b.registrationDate) return -1;
          return a.registrationDate - b.registrationDate;
        });

        const oldestClient = clients[0]; // Conservar fecha más antigua
        const newestClient = clients[clients.length - 1]; // Datos más actualizados
        
        // Combinar datos: fecha más antigua + datos más recientes
        const combinedClient = {
          ...oldestClient,
          firstName: newestClient.firstName,
          lastName: newestClient.lastName,
          phone: newestClient.phone || oldestClient.phone,
          email: newestClient.email || oldestClient.email,
          address: newestClient.address || oldestClient.address,
          city: newestClient.city || oldestClient.city
        };

        const validationErrors = validateClient(combinedClient);
        if (validationErrors.length > 0) {
          results.errors.push({
            dni,
            client: `${combinedClient.firstName} ${combinedClient.lastName}`,
            errors: validationErrors
          });
          results.skipped++;
          continue;
        }

        // Verificar si ya existe en la base de datos
        const existingClient = await prisma.client.findFirst({
          where: {
            OR: [
              { documentNumber: dni },
              ...(combinedClient.email ? [{ email: combinedClient.email }] : [])
            ]
          }
        });

        if (existingClient) {
          console.log(`⚠️  Cliente ya existe en BD: ${combinedClient.firstName} ${combinedClient.lastName} (${dni})`);
          results.skipped++;
          continue;
        }

        // Crear cliente combinado
        await prisma.client.create({
          data: {
            firstName: combinedClient.firstName,
            lastName: combinedClient.lastName,
            documentType: combinedClient.documentType,
            documentNumber: combinedClient.documentNumber,
            phone: combinedClient.phone,
            email: combinedClient.email,
            notes: `Cliente consolidado (${clients.length} registros originales)`
          }
        });

        console.log(`✅ Cliente consolidado: ${combinedClient.firstName} ${combinedClient.lastName} (${clients.length} registros)`);
        results.created++;
      }

    } catch (error) {
      console.error(`❌ Error procesando DNI ${dni}:`, error.message);
      results.errors.push({
        dni,
        client: 'Error en procesamiento',
        errors: [error.message]
      });
      results.skipped++;
    }
  }

  return results;
}

// Función principal de migración
async function migratePasajeros(filePath) {
  console.log('🚀 Iniciando migración de pasajeros...');
  console.log(`📁 Archivo: ${filePath}`);
  
  // Leer archivo Excel
  const data = readExcelFile(filePath);
  if (!data) {
    return;
  }

  // Analizar estructura
  const structure = analyzeDataStructure(data);
  if (!structure) {
    return;
  }

  // Extraer todos los clientes de todas las filas
  console.log('\n🔄 Extrayendo clientes de todas las filas...');
  const allClients = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const clients = extractClientsFromRow(row, structure.headers);
    
    if (clients.length > 0) {
      console.log(`   Fila ${i + 1}: ${clients.length} clientes encontrados`);
      allClients.push(...clients);
    }
  }

  console.log(`\n📊 Total de clientes extraídos: ${allClients.length}`);

  // Procesar clientes (crear/actualizar en BD)
  console.log('\n💾 Procesando clientes en la base de datos...');
  const results = await processClients(allClients);

  // Mostrar resultados
  console.log('\n📈 Resultados de la migración:');
  console.log(`✅ Clientes creados: ${results.created}`);
  console.log(`⚠️  Clientes omitidos: ${results.skipped}`);
  
  if (results.errors.length > 0) {
    console.log(`❌ Errores encontrados: ${results.errors.length}`);
    console.log('\n📝 Detalles de errores:');
    results.errors.forEach(error => {
      console.log(`   DNI ${error.dni}: ${error.client} - ${error.errors.join(', ')}`);
    });
  }

  console.log('\n🎉 Migración completada!');
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🔧 Script de Migración de Pasajeros

Uso:
  node pasajeros-migration.js <ARCHIVO_EXCEL>

Parámetros:
  ARCHIVO_EXCEL  - Ruta al archivo .xlsx (obligatorio)

Ejemplo:
  node pasajeros-migration.js "Registro de pasajeros.xlsx"

Características:
- Extrae clientes principales y acompañantes de cada fila
- Detecta duplicados por DNI
- Conserva la fecha de registro más antigua
- Usa los datos más actualizados para duplicados
- Valida datos antes de importar
- Evita duplicados en la base de datos
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
    await migratePasajeros(filePath);
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
  migratePasajeros,
  readExcelFile,
  analyzeDataStructure,
  extractClientsFromRow,
  validateClient,
  processClients
}; 