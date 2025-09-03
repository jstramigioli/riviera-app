const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3001/api';

// Función simple para hacer requests HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAPITagFiltering() {
  try {
    console.log('🧪 Probando API de filtrado por etiquetas...\n');

    // 1. Obtener todas las etiquetas
    console.log('📋 Obteniendo etiquetas disponibles...');
    const tagsResponse = await makeRequest(`${API_BASE}/tags`);
    const tags = tagsResponse.data;
    
    console.log(`Etiquetas encontradas: ${tags.length}`);
    tags.slice(0, 5).forEach(tag => {
      console.log(`  - ${tag.name} (ID: ${tag.id})`);
    });

    // 2. Probar búsqueda sin etiquetas
    console.log('\n🔍 Probando búsqueda sin etiquetas...');
    const searchParams = new URLSearchParams({
      checkIn: '2025-01-15',
      checkOut: '2025-01-17',
      requiredGuests: '2'
    });

    const response1 = await makeRequest(`${API_BASE}/reservations/available-rooms?${searchParams}`);
    const result1 = response1.data;
    
    console.log(`Habitaciones encontradas: ${result1.availableRooms.length}`);
    console.log(`Requerimientos: ${JSON.stringify(result1.requirements)}`);

    // 3. Probar búsqueda con una etiqueta específica
    if (tags.length > 0) {
      const testTag = tags.find(t => t.name === 'Planta baja') || tags[0];
      console.log(`\n🔍 Probando búsqueda con etiqueta "${testTag.name}"...`);
      
      const searchParamsWithTag = new URLSearchParams({
        checkIn: '2025-01-15',
        checkOut: '2025-01-17',
        requiredGuests: '2',
        requiredTags: testTag.id.toString()
      });

      const response2 = await makeRequest(`${API_BASE}/reservations/available-rooms?${searchParamsWithTag}`);
      const result2 = response2.data;
      
      console.log(`Habitaciones encontradas: ${result2.availableRooms.length}`);
      console.log(`Requerimientos: ${JSON.stringify(result2.requirements)}`);
      
      if (result2.availableRooms.length > 0) {
        console.log('Primeras 3 habitaciones:');
        result2.availableRooms.slice(0, 3).forEach(room => {
          const tagNames = room.tags.map(t => t.name).join(', ');
          console.log(`  - ${room.name} (${room.roomType.name}): [${tagNames || 'Sin etiquetas'}]`);
        });
      }
    }

    // 4. Probar búsqueda con múltiples etiquetas
    if (tags.length >= 2) {
      const testTags = tags.slice(0, 2);
      console.log(`\n🔍 Probando búsqueda con múltiples etiquetas (${testTags.map(t => t.name).join(', ')})...`);
      
      const searchParamsMultipleTags = new URLSearchParams({
        checkIn: '2025-01-15',
        checkOut: '2025-01-17',
        requiredGuests: '2'
      });
      
      testTags.forEach(tag => {
        searchParamsMultipleTags.append('requiredTags', tag.id.toString());
      });

      const response3 = await makeRequest(`${API_BASE}/reservations/available-rooms?${searchParamsMultipleTags}`);
      const result3 = response3.data;
      
      console.log(`Habitaciones encontradas: ${result3.availableRooms.length}`);
      console.log(`Requerimientos: ${JSON.stringify(result3.requirements)}`);
      
      if (result3.availableRooms.length > 0) {
        console.log('Primeras 3 habitaciones:');
        result3.availableRooms.slice(0, 3).forEach(room => {
          const tagNames = room.tags.map(t => t.name).join(', ');
          console.log(`  - ${room.name} (${room.roomType.name}): [${tagNames || 'Sin etiquetas'}]`);
        });
      }
    }

    // 5. Probar búsqueda para 4 personas (debería incluir habitaciones virtuales)
    console.log('\n🔍 Probando búsqueda para 4 personas (incluye habitaciones virtuales)...');
    const searchParams4Guests = new URLSearchParams({
      checkIn: '2025-01-15',
      checkOut: '2025-01-17',
      requiredGuests: '4'
    });

    const response4 = await makeRequest(`${API_BASE}/reservations/available-rooms?${searchParams4Guests}`);
    const result4 = response4.data;
    
    console.log(`Habitaciones encontradas: ${result4.availableRooms.length}`);
    console.log(`Capacidad exacta: ${result4.exactCapacityCount}`);
    console.log(`Mayor capacidad: ${result4.largerCapacityCount}`);
    
    if (result4.availableRooms.length > 0) {
      console.log('Habitaciones encontradas:');
      result4.availableRooms.forEach(room => {
        const isVirtual = room.isVirtual ? ' 🏗️ Virtual' : '';
        const tagNames = room.tags.map(t => t.name).join(', ');
        console.log(`  - ${room.name} (${room.roomType.name}, ${room.maxPeople} pers.)${isVirtual}: [${tagNames || 'Sin etiquetas'}]`);
      });
    }

    console.log('\n✅ Prueba de API completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la prueba de API:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Asegúrate de que el servidor backend esté ejecutándose en http://localhost:3001');
    }
  }
}

// Ejecutar la prueba
testAPITagFiltering(); 