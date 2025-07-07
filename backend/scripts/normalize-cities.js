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
  'BUENOS AIRES': 'CIUDAD AUTÓNOMA DE BUENOS AIRES', // Por defecto, asumimos que se refiere a la ciudad
  'C.A.B.A.': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'C.A.B.A': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAPITAL FEDERAL': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAP. FED.': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  'CAP. FED': 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  
  // Otras variaciones comunes
  'ROSARIO': 'ROSARIO',
  'CORDOBA': 'CÓRDOBA',
  'CÓRDOBA': 'CÓRDOBA', // Por defecto, asumimos que se refiere a la ciudad capital
  'MENDOZA': 'MENDOZA',
  'LA PLATA': 'LA PLATA',
  'MAR DEL PLATA': 'MAR DEL PLATA',
  'SALTA': 'SALTA',
  'TUCUMAN': 'SAN MIGUEL DE TUCUMÁN',
  'TUCUMÁN': 'SAN MIGUEL DE TUCUMÁN',
  'SAN MIGUEL DE TUCUMAN': 'SAN MIGUEL DE TUCUMÁN',
  'SAN MIGUEL DE TUCUMÁN': 'SAN MIGUEL DE TUCUMÁN',
  
  // Agregar más variaciones según sea necesario
};

// Crear un mapa de ciudades para búsqueda rápida
const citiesMap = new Map();
const provincesMap = new Map();

// Procesar las localidades para crear mapas de búsqueda
argLocalities.forEach(province => {
  const provinceName = province.province;
  provincesMap.set(provinceName, provinceName);
  
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

// Función para normalizar clientes
async function normalizeClients() {
  console.log('🔍 Normalizando ciudades de clientes...');
  
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { city: { not: null } },
        { province: { not: null } }
      ]
    }
  });
  
  console.log(`📊 Encontrados ${clients.length} clientes con datos de ubicación`);
  
  let updatedCount = 0;
  let notFoundCount = 0;
  
  for (const client of clients) {
    let needsUpdate = false;
    const updateData = {};
    
    // Normalizar ciudad si existe
    if (client.city) {
      const normalized = normalizeCity(client.city);
      if (normalized) {
        if (normalized.city !== client.city || normalized.province !== client.province) {
          updateData.city = normalized.city;
          updateData.province = normalized.province;
          needsUpdate = true;
          console.log(`✅ Cliente ${client.id}: "${client.city}" -> "${normalized.city}" (${normalized.province})`);
        }
      } else {
        console.log(`❌ Cliente ${client.id}: Ciudad no encontrada - "${client.city}"`);
        notFoundCount++;
      }
    }
    
    // Si no tiene provincia pero sí ciudad, intentar agregar la provincia
    if (!client.province && client.city) {
      const normalized = normalizeCity(client.city);
      if (normalized) {
        updateData.province = normalized.province;
        needsUpdate = true;
        console.log(`📍 Cliente ${client.id}: Agregando provincia "${normalized.province}" para "${client.city}"`);
      }
    }
    
    if (needsUpdate) {
      await prisma.client.update({
        where: { id: client.id },
        data: updateData
      });
      updatedCount++;
    }
  }
  
  console.log(`\n📈 Resumen de clientes:`);
  console.log(`   ✅ Actualizados: ${updatedCount}`);
  console.log(`   ❌ No encontrados: ${notFoundCount}`);
}

// Función para normalizar huéspedes
async function normalizeGuests() {
  console.log('\n🔍 Normalizando ciudades de huéspedes...');
  
  const guests = await prisma.guest.findMany({
    where: {
      OR: [
        { city: { not: null } },
        { address: { not: null } }
      ]
    }
  });
  
  console.log(`📊 Encontrados ${guests.length} huéspedes con datos de ubicación`);
  
  let updatedCount = 0;
  let notFoundCount = 0;
  
  for (const guest of guests) {
    let needsUpdate = false;
    const updateData = {};
    
    // Normalizar ciudad si existe
    if (guest.city) {
      const normalized = normalizeCity(guest.city);
      if (normalized) {
        if (normalized.city !== guest.city) {
          updateData.city = normalized.city;
          needsUpdate = true;
          console.log(`✅ Huésped ${guest.id}: "${guest.city}" -> "${normalized.city}"`);
        }
      } else {
        console.log(`❌ Huésped ${guest.id}: Ciudad no encontrada - "${guest.city}"`);
        notFoundCount++;
      }
    }
    
    // Intentar extraer ciudad del campo address si no tiene city
    if (!guest.city && guest.address) {
      // Buscar patrones comunes en la dirección
      const addressParts = guest.address.split(',').map(part => part.trim());
      for (const part of addressParts) {
        const normalized = normalizeCity(part);
        if (normalized) {
          updateData.city = normalized.city;
          needsUpdate = true;
          console.log(`📍 Huésped ${guest.id}: Extrayendo ciudad "${normalized.city}" de dirección "${guest.address}"`);
          break;
        }
      }
    }
    
    if (needsUpdate) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: updateData
      });
      updatedCount++;
    }
  }
  
  console.log(`\n📈 Resumen de huéspedes:`);
  console.log(`   ✅ Actualizados: ${updatedCount}`);
  console.log(`   ❌ No encontrados: ${notFoundCount}`);
}

// Función principal
async function main() {
  try {
    console.log('🚀 Iniciando normalización de ciudades y provincias...\n');
    
    await normalizeClients();
    await normalizeGuests();
    
    console.log('\n✅ Normalización completada exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la normalización:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { normalizeCity, normalizeClients, normalizeGuests }; 