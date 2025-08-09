const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Configuración de axios para manejar errores
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Función auxiliar para hacer requests y mostrar resultados
async function makeRequest(method, url, data = null, description = '') {
  try {
    console.log(`\n🔄 ${description}`);
    console.log(`${method.toUpperCase()} ${url}`);
    if (data) {
      console.log('Body:', JSON.stringify(data, null, 2));
    }
    
    const response = await api({ method, url, data });
    console.log(`✅ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || 'Network Error'}`);
    if (error.response?.data) {
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error Message:', error.message);
    }
    return null;
  }
}

async function testTariffEndpoints() {
  console.log('🧪 Probando endpoints del nuevo sistema de tarifas...\n');
  
  let createdServiceTypeId = null;
  let createdSeasonBlockId = null;
  
  try {
    // ===== PRUEBAS DE TIPOS DE SERVICIO =====
    console.log('\n📋 === PRUEBAS DE TIPOS DE SERVICIO ===');
    
    // 1. Listar tipos de servicio existentes
    const existingServiceTypes = await makeRequest(
      'GET', 
      '/service-types',
      null,
      'Listar tipos de servicio existentes'
    );
    
    // 2. Crear un nuevo tipo de servicio
    const newServiceType = await makeRequest(
      'POST',
      '/service-types',
      {
        name: 'Servicio de Prueba API',
        description: 'Tipo de servicio creado desde la API de prueba',
        hotelId: 'default-hotel'
      },
      'Crear nuevo tipo de servicio'
    );
    
    if (newServiceType?.data?.id) {
      createdServiceTypeId = newServiceType.data.id;
    }
    
    // 3. Obtener el tipo de servicio creado
    if (createdServiceTypeId) {
      await makeRequest(
        'GET',
        `/service-types/${createdServiceTypeId}`,
        null,
        'Obtener tipo de servicio específico'
      );
    }
    
    // 4. Actualizar el tipo de servicio
    if (createdServiceTypeId) {
      await makeRequest(
        'PUT',
        `/service-types/${createdServiceTypeId}`,
        {
          name: 'Servicio de Prueba API Actualizado',
          description: 'Descripción actualizada desde la API'
        },
        'Actualizar tipo de servicio'
      );
    }
    
    // 5. Listar tipos de servicio después de crear uno nuevo
    await makeRequest(
      'GET',
      '/service-types',
      null,
      'Listar tipos de servicio después de crear uno nuevo'
    );
    
    // ===== PRUEBAS DE BLOQUES DE TEMPORADA =====
    console.log('\n🏖️ === PRUEBAS DE BLOQUES DE TEMPORADA ===');
    
    // 6. Listar bloques de temporada existentes
    const existingSeasonBlocks = await makeRequest(
      'GET',
      '/season-blocks',
      null,
      'Listar bloques de temporada existentes'
    );
    
    // 7. Obtener tipos de habitación para usar en las pruebas
    const roomTypes = await makeRequest(
      'GET',
      '/room-types',
      null,
      'Obtener tipos de habitación para las pruebas'
    );
    
    let roomTypeIds = [];
    if (roomTypes?.length > 0) {
      roomTypeIds = roomTypes.slice(0, 2).map(rt => rt.id); // Tomar los primeros 2
    }
    
    let serviceTypeIds = [];
    if (existingServiceTypes?.data?.length > 0) {
      serviceTypeIds = existingServiceTypes.data.slice(0, 2).map(st => st.id); // Tomar los primeros 2
    }
    
    // 8. Crear un nuevo bloque de temporada
    if (roomTypeIds.length > 0 && serviceTypeIds.length > 0) {
      const newSeasonBlock = await makeRequest(
        'POST',
        '/season-blocks',
        {
          name: 'Bloque de Prueba API',
          description: 'Bloque creado desde la API de prueba',
          startDate: '2024-09-01',
          endDate: '2024-09-30',
          hotelId: 'default-hotel',
          checkOverlaps: false, // Deshabilitamos verificación de solapamientos para la prueba
          seasonPrices: roomTypeIds.map(roomTypeId => ({
            roomTypeId,
            basePrice: 75000
          })),
          seasonServiceAdjustments: serviceTypeIds.flatMap(serviceTypeId =>
            roomTypeIds.map(roomTypeId => ({
              serviceTypeId,
              roomTypeId,
              mode: 'PERCENTAGE',
              value: 15
            }))
          )
        },
        'Crear nuevo bloque de temporada con precios y ajustes'
      );
      
      if (newSeasonBlock?.data?.id) {
        createdSeasonBlockId = newSeasonBlock.data.id;
      }
    } else {
      console.log('⚠️  No hay suficientes tipos de habitación o servicio para crear un bloque completo');
    }
    
    // 9. Obtener el bloque de temporada creado
    if (createdSeasonBlockId) {
      await makeRequest(
        'GET',
        `/season-blocks/${createdSeasonBlockId}`,
        null,
        'Obtener bloque de temporada específico'
      );
    }
    
    // 10. Actualizar el bloque de temporada
    if (createdSeasonBlockId && roomTypeIds.length > 0) {
      await makeRequest(
        'PUT',
        `/season-blocks/${createdSeasonBlockId}`,
        {
          name: 'Bloque de Prueba API Actualizado',
          description: 'Descripción actualizada',
          seasonPrices: roomTypeIds.map(roomTypeId => ({
            roomTypeId,
            basePrice: 85000 // Precio actualizado
          }))
        },
        'Actualizar bloque de temporada'
      );
    }
    
    // 11. Listar bloques después de crear uno nuevo
    await makeRequest(
      'GET',
      '/season-blocks',
      null,
      'Listar bloques de temporada después de crear uno nuevo'
    );
    
    // ===== PRUEBAS DE VALIDACIONES =====
    console.log('\n⚠️ === PRUEBAS DE VALIDACIONES ===');
    
    // 12. Intentar crear tipo de servicio sin nombre
    await makeRequest(
      'POST',
      '/service-types',
      {
        description: 'Servicio sin nombre'
      },
      'Intentar crear tipo de servicio sin nombre (debe fallar)'
    );
    
    // 13. Intentar crear bloque con fechas inválidas
    await makeRequest(
      'POST',
      '/season-blocks',
      {
        name: 'Bloque con fechas inválidas',
        startDate: '2024-09-30',
        endDate: '2024-09-01' // Fecha fin antes que inicio
      },
      'Intentar crear bloque con fechas inválidas (debe fallar)'
    );
    
    // 14. Intentar crear bloque con ajuste de porcentaje fuera de rango
    if (roomTypeIds.length > 0 && serviceTypeIds.length > 0) {
      await makeRequest(
        'POST',
        '/season-blocks',
        {
          name: 'Bloque con porcentaje inválido',
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          seasonServiceAdjustments: [{
            serviceTypeId: serviceTypeIds[0],
            roomTypeId: roomTypeIds[0],
            mode: 'PERCENTAGE',
            value: 600 // Fuera del rango permitido
          }]
        },
        'Intentar crear bloque con porcentaje fuera de rango (debe fallar)'
      );
    }
    
    // ===== LIMPIEZA =====
    console.log('\n🧹 === LIMPIEZA ===');
    
    // 15. Eliminar el bloque de temporada creado
    if (createdSeasonBlockId) {
      await makeRequest(
        'DELETE',
        `/season-blocks/${createdSeasonBlockId}`,
        null,
        'Eliminar bloque de temporada creado'
      );
    }
    
    // 16. Eliminar el tipo de servicio creado
    if (createdServiceTypeId) {
      await makeRequest(
        'DELETE',
        `/service-types/${createdServiceTypeId}`,
        null,
        'Eliminar tipo de servicio creado'
      );
    }
    
    console.log('\n✅ ¡Pruebas completadas!');
    console.log('\n📊 RESUMEN:');
    console.log('- Todos los endpoints principales probados');
    console.log('- Validaciones de datos probadas');
    console.log('- Operaciones CRUD completas');
    console.log('- Limpieza de datos de prueba realizada');
    
  } catch (error) {
    console.error('\n❌ Error general durante las pruebas:', error.message);
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  console.log('🚀 Iniciando servidor de pruebas...');
  console.log('Asegúrate de que el servidor esté corriendo en el puerto 3001');
  
  // Esperar un poco para que el servidor esté listo
  setTimeout(() => {
    testTariffEndpoints();
  }, 1000);
}

module.exports = { testTariffEndpoints }; 