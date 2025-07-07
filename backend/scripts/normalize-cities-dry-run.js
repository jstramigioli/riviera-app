const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Cargar el archivo de localidades argentinas
const argLocalitiesPath = path.join(__dirname, '../../frontend/src/assets/arg-localities.json');
const argLocalities = JSON.parse(fs.readFileSync(argLocalitiesPath, 'utf8'));

// Mapeo de variaciones comunes de nombres de ciudades
const cityVariations = {
  // Ciudad Autónoma de Buenos Aires
  'CABA': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'BUENOS AIRES': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'C.A.B.A.': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'C.A.B.A': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAPITAL FEDERAL': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAP. FED.': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAP. FED': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  
  // Otras variaciones comunes
  'ROSARIO': 'ROSARIO',
  'CORDOBA': 'CÓRDOBA',
  'CÓRDOBA': 'CÓRDOBA',
  'MENDOZA': 'MENDOZA',
  'LA PLATA': 'LA PLATA',
  'MAR DEL PLATA': 'MAR DEL PLATA',
  'SALTA': 'SALTA',
  'TUCUMAN': 'SAN MIGUEL DE TUCUMÁN',
  'TUCUMÁN': 'SAN MIGUEL DE TUCUMÁN',
  'SAN MIGUEL DE TUCUMAN': 'SAN MIGUEL DE TUCUMÁN',
  'SAN MIGUEL DE TUCUMÁN': 'SAN MIGUEL DE TUCUMÁN',
};

// Crear un mapa de ciudades para búsqueda rápida
const citiesMap = new Map();

// Procesar las localidades para crear mapas de búsqueda
argLocalities.forEach(province => {
  const provinceName = province.province;
  
  // Eliminar duplicados de ciudades
  const uniqueCities = new Set();
  province.localities.forEach(locality => {
    uniqueCities.add(locality.name);
  });
  
  uniqueCities.forEach(cityName => {
    citiesMap.set(cityName, {
      city: cityName,
      province: provinceName
    });
  });
});

// Función para normalizar una ciudad
function normalizeCity(cityName) {
  if (!cityName) return null;
  
  const normalizedName = cityName.trim().toUpperCase();
  
  // Casos especiales que requieren lógica adicional
  if (normalizedName === 'BUENOS AIRES') {
    // Buscar en la Ciudad Autónoma de Buenos Aires
    const cabaProvince = argLocalities.find(prov => prov.province === 'Ciudad Autónoma de Buenos Aires');
    if (cabaProvince && cabaProvince.localities.length > 0) {
      // Tomar la primera localidad como representativa de la ciudad
      return {
        city: cabaProvince.localities[0].name,
        province: 'Ciudad Autónoma de Buenos Aires'
      };
    }
  }
  
  if (normalizedName === 'CÓRDOBA' || normalizedName === 'CORDOBA') {
    // Buscar en la provincia de Córdoba
    const cordobaProvince = argLocalities.find(prov => prov.province === 'Córdoba');
    if (cordobaProvince) {
      // Buscar la ciudad de Córdoba específicamente
      const cordobaCity = cordobaProvince.localities.find(loc => 
        loc.name.toLowerCase().includes('córdoba') || 
        loc.name.toLowerCase().includes('cordoba')
      );
      if (cordobaCity) {
        return {
          city: cordobaCity.name,
          province: 'Córdoba'
        };
      }
    }
  }
  
  // Primero verificar si es una variación conocida
  if (cityVariations[normalizedName]) {
    const standardName = cityVariations[normalizedName];
    return citiesMap.get(standardName) || null;
  }
  
  // Buscar coincidencia exacta
  if (citiesMap.has(normalizedName)) {
    return citiesMap.get(normalizedName);
  }
  
  // Buscar coincidencia exacta ignorando mayúsculas/minúsculas
  for (const [city, data] of citiesMap) {
    if (city.toLowerCase() === normalizedName.toLowerCase()) {
      return data;
    }
  }
  
  // Buscar coincidencia que contenga el término (más flexible)
  for (const [city, data] of citiesMap) {
    const cityLower = city.toLowerCase();
    const searchLower = normalizedName.toLowerCase();
    
    // Coincidencia exacta de palabras
    if (cityLower === searchLower) {
      return data;
    }
    
    // Coincidencia que empiece con el término
    if (cityLower.startsWith(searchLower)) {
      return data;
    }
    
    // Coincidencia que contenga el término
    if (cityLower.includes(searchLower)) {
      return data;
    }
  }
  
  return null;
}

// Función para analizar clientes (sin modificar)
async function analyzeClients() {
  console.log('🔍 Analizando ciudades de clientes...\n');
  
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { city: { not: null } },
        { province: { not: null } }
      ]
    }
  });
  
  console.log(`📊 Encontrados ${clients.length} clientes con datos de ubicación\n`);
  
  const changes = [];
  const notFound = [];
  
  for (const client of clients) {
    // Normalizar ciudad si existe
    if (client.city) {
      const normalized = normalizeCity(client.city);
      if (normalized) {
        if (normalized.city !== client.city || normalized.province !== client.province) {
          changes.push({
            id: client.id,
            name: `${client.firstName} ${client.lastName}`,
            currentCity: client.city,
            currentProvince: client.province,
            newCity: normalized.city,
            newProvince: normalized.province,
            type: 'update'
          });
        }
      } else {
        notFound.push({
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          city: client.city,
          type: 'not_found'
        });
      }
    }
    
    // Si no tiene provincia pero sí ciudad, intentar agregar la provincia
    if (!client.province && client.city) {
      const normalized = normalizeCity(client.city);
      if (normalized) {
        changes.push({
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          currentCity: client.city,
          currentProvince: client.province,
          newCity: normalized.city,
          newProvince: normalized.province,
          type: 'add_province'
        });
      }
    }
  }
  
  // Mostrar cambios propuestos
  if (changes.length > 0) {
    console.log('🔄 CAMBIOS PROPUESTOS PARA CLIENTES:');
    console.log('=' .repeat(80));
    changes.forEach(change => {
      if (change.type === 'update') {
        console.log(`ID ${change.id} (${change.name}):`);
        console.log(`  Ciudad: "${change.currentCity}" -> "${change.newCity}"`);
        console.log(`  Provincia: "${change.currentProvince || 'N/A'}" -> "${change.newProvince}"`);
      } else if (change.type === 'add_province') {
        console.log(`ID ${change.id} (${change.name}):`);
        console.log(`  Agregar provincia: "${change.newProvince}" para "${change.currentCity}"`);
      }
      console.log('');
    });
  }
  
  if (notFound.length > 0) {
    console.log('❌ CIUDADES NO ENCONTRADAS:');
    console.log('=' .repeat(80));
    notFound.forEach(item => {
      console.log(`ID ${item.id} (${item.name}): "${item.city}"`);
    });
    console.log('');
  }
  
  console.log(`📈 RESUMEN DE CLIENTES:`);
  console.log(`   🔄 Cambios propuestos: ${changes.length}`);
  console.log(`   ❌ No encontrados: ${notFound.length}`);
  
  return { changes, notFound };
}

// Función para analizar huéspedes (sin modificar)
async function analyzeGuests() {
  console.log('\n🔍 Analizando ciudades de huéspedes...\n');
  
  const guests = await prisma.guest.findMany({
    where: {
      OR: [
        { city: { not: null } },
        { address: { not: null } }
      ]
    }
  });
  
  console.log(`📊 Encontrados ${guests.length} huéspedes con datos de ubicación\n`);
  
  const changes = [];
  const notFound = [];
  
  for (const guest of guests) {
    // Normalizar ciudad si existe
    if (guest.city) {
      const normalized = normalizeCity(guest.city);
      if (normalized) {
        if (normalized.city !== guest.city) {
          changes.push({
            id: guest.id,
            name: `${guest.firstName} ${guest.lastName}`,
            currentCity: guest.city,
            newCity: normalized.city,
            type: 'update'
          });
        }
      } else {
        notFound.push({
          id: guest.id,
          name: `${guest.firstName} ${guest.lastName}`,
          city: guest.city,
          type: 'not_found'
        });
      }
    }
    
    // Intentar extraer ciudad del campo address si no tiene city
    if (!guest.city && guest.address) {
      const addressParts = guest.address.split(',').map(part => part.trim());
      for (const part of addressParts) {
        const normalized = normalizeCity(part);
        if (normalized) {
          changes.push({
            id: guest.id,
            name: `${guest.firstName} ${guest.lastName}`,
            address: guest.address,
            extractedCity: part,
            newCity: normalized.city,
            type: 'extract_from_address'
          });
          break;
        }
      }
    }
  }
  
  // Mostrar cambios propuestos
  if (changes.length > 0) {
    console.log('🔄 CAMBIOS PROPUESTOS PARA HUÉSPEDES:');
    console.log('=' .repeat(80));
    changes.forEach(change => {
      if (change.type === 'update') {
        console.log(`ID ${change.id} (${change.name}):`);
        console.log(`  Ciudad: "${change.currentCity}" -> "${change.newCity}"`);
      } else if (change.type === 'extract_from_address') {
        console.log(`ID ${change.id} (${change.name}):`);
        console.log(`  Extraer de dirección: "${change.address}"`);
        console.log(`  Ciudad extraída: "${change.extractedCity}" -> "${change.newCity}"`);
      }
      console.log('');
    });
  }
  
  if (notFound.length > 0) {
    console.log('❌ CIUDADES NO ENCONTRADAS:');
    console.log('=' .repeat(80));
    notFound.forEach(item => {
      console.log(`ID ${item.id} (${item.name}): "${item.city}"`);
    });
    console.log('');
  }
  
  console.log(`📈 RESUMEN DE HUÉSPEDES:`);
  console.log(`   🔄 Cambios propuestos: ${changes.length}`);
  console.log(`   ❌ No encontrados: ${notFound.length}`);
  
  return { changes, notFound };
}

// Función principal
async function main() {
  try {
    console.log('🚀 INICIANDO ANÁLISIS DE NORMALIZACIÓN (MODO PRUEBA)\n');
    console.log('⚠️  ESTE ES UN ANÁLISIS EN SECO - NO SE MODIFICARÁ LA BASE DE DATOS\n');
    
    const clientResults = await analyzeClients();
    const guestResults = await analyzeGuests();
    
    const totalChanges = clientResults.changes.length + guestResults.changes.length;
    const totalNotFound = clientResults.notFound.length + guestResults.notFound.length;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN GENERAL:');
    console.log(`   🔄 Total de cambios propuestos: ${totalChanges}`);
    console.log(`   ❌ Total de ciudades no encontradas: ${totalNotFound}`);
    console.log('='.repeat(80));
    
    if (totalChanges > 0) {
      console.log('\n💡 Para aplicar estos cambios, ejecuta: node scripts/normalize-cities.js');
    }
    
  } catch (error) {
    console.error('❌ Error durante el análisis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
} 