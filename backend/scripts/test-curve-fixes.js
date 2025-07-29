const http = require('http');

async function testCurveFixes() {
  try {
    console.log('🧪 Probando correcciones de la curva estacional...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Verificar que se pueden obtener keyframes operacionales
    console.log('\n📊 1. Verificando keyframes operacionales...');
    const keyframesResponse = await makeRequest(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`, 'GET');
    
    if (keyframesResponse.status === 200) {
      const keyframes = JSON.parse(keyframesResponse.data);
      const operationalKeyframes = keyframes.filter(k => k.isOperational);
      const normalKeyframes = keyframes.filter(k => !k.isOperational);
      
      console.log(`✅ Keyframes totales: ${keyframes.length}`);
      console.log(`✅ Keyframes operacionales: ${operationalKeyframes.length}`);
      console.log(`✅ Keyframes normales: ${normalKeyframes.length}`);
      
      // 2. Probar actualización de precio de keyframe operacional
      if (operationalKeyframes.length > 0) {
        const testKeyframe = operationalKeyframes[0];
        console.log(`\n📊 2. Probando actualización de precio operacional...`);
        console.log(`   Keyframe: ${testKeyframe.id} - ${testKeyframe.operationalType} - $${testKeyframe.basePrice}`);
        
        const newPrice = testKeyframe.basePrice + 1000;
        const updateResponse = await makeRequest(
          `${API_URL}/dynamic-pricing/operational-keyframes/${testKeyframe.id}/price`,
          'PUT',
          { basePrice: newPrice }
        );
        
        if (updateResponse.status === 200) {
          console.log(`✅ Precio actualizado exitosamente: $${newPrice}`);
        } else {
          console.log(`❌ Error al actualizar precio: ${updateResponse.status}`);
        }
      }
      
      // 3. Probar creación de keyframe normal
      console.log('\n📊 3. Probando creación de keyframe normal...');
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 30); // 30 días en el futuro
      
      const newKeyframe = {
        date: testDate.toISOString(),
        basePrice: 12000,
        isOperational: false
      };
      
      const createResponse = await makeRequest(
        `${API_URL}/dynamic-pricing/keyframes/${hotelId}`,
        'POST',
        newKeyframe
      );
      
      if (createResponse.status === 201) {
        console.log(`✅ Keyframe normal creado exitosamente`);
      } else {
        console.log(`❌ Error al crear keyframe: ${createResponse.status}`);
        if (createResponse.data) {
          const errorData = JSON.parse(createResponse.data);
          console.log(`   Error: ${errorData.message}`);
        }
      }
    }
    
    console.log('\n🎉 Pruebas completadas!');
    console.log('\n📝 Instrucciones para verificar en el frontend:');
    console.log('   1. Ve al frontend y navega a Configuración > Curva Estacional');
    console.log('   2. Verifica que puedes hacer clic en los puntos de apertura/cierre');
    console.log('   3. Verifica que puedes editar el precio de los keyframes operacionales');
    console.log('   4. Verifica que puedes agregar nuevos keyframes normales');
    console.log('   5. Verifica que el botón "Guardar Cambios" funciona correctamente');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

function makeRequest(url, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

testCurveFixes(); 