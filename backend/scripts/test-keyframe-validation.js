const http = require('http');

async function testKeyframeValidation() {
  try {
    console.log('🧪 Probando validaciones de keyframes fuera de períodos operacionales...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional de prueba
    console.log('\n1️⃣ Creando período operacional de prueba...');
    
    const periodData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      label: 'Test Validación Keyframes'
    });
    
    const createPeriodOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/operational-periods/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(periodData)
      }
    };
    
    const createPeriodResponse = await new Promise((resolve, reject) => {
      const req = http.request(createPeriodOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(periodData);
      req.end();
    });
    
    if (createPeriodResponse.status !== 201) {
      console.error('❌ Error al crear período:', createPeriodResponse.data);
      return;
    }
    
    const period = JSON.parse(createPeriodResponse.data);
    console.log(`✅ Período creado: ${period.id}`);
    
    // 2. Intentar crear un keyframe DENTRO del período (debería funcionar)
    console.log('\n2️⃣ Probando crear keyframe DENTRO del período (debería funcionar)...');
    
    const validKeyframeData = JSON.stringify({
      date: '2024-07-15',
      basePrice: 8500,
      isOperational: false
    });
    
    const createValidKeyframeOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(validKeyframeData)
      }
    };
    
    const createValidKeyframeResponse = await new Promise((resolve, reject) => {
      const req = http.request(createValidKeyframeOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(validKeyframeData);
      req.end();
    });
    
    if (createValidKeyframeResponse.status === 201) {
      console.log('✅ Keyframe creado correctamente dentro del período');
    } else {
      console.log('❌ Error al crear keyframe dentro del período:', createValidKeyframeResponse.data);
    }
    
    // 3. Intentar crear un keyframe FUERA del período (debería fallar)
    console.log('\n3️⃣ Probando crear keyframe FUERA del período (debería fallar)...');
    
    const invalidKeyframeData = JSON.stringify({
      date: '2024-05-15', // Antes del período
      basePrice: 8500,
      isOperational: false
    });
    
    const createInvalidKeyframeOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(invalidKeyframeData)
      }
    };
    
    const createInvalidKeyframeResponse = await new Promise((resolve, reject) => {
      const req = http.request(createInvalidKeyframeOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(invalidKeyframeData);
      req.end();
    });
    
    if (createInvalidKeyframeResponse.status === 400) {
      console.log('✅ Validación funcionó correctamente - se rechazó keyframe fuera del período');
      console.log('📝 Mensaje de error:', JSON.parse(createInvalidKeyframeResponse.data).message);
    } else {
      console.log('❌ La validación no funcionó como esperado:', createInvalidKeyframeResponse.data);
    }
    
    // 4. Intentar crear otro keyframe FUERA del período (después del período)
    console.log('\n4️⃣ Probando crear keyframe DESPUÉS del período (debería fallar)...');
    
    const invalidKeyframeData2 = JSON.stringify({
      date: '2024-09-15', // Después del período
      basePrice: 8500,
      isOperational: false
    });
    
    const createInvalidKeyframeOptions2 = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(invalidKeyframeData2)
      }
    };
    
    const createInvalidKeyframeResponse2 = await new Promise((resolve, reject) => {
      const req = http.request(createInvalidKeyframeOptions2, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(invalidKeyframeData2);
      req.end();
    });
    
    if (createInvalidKeyframeResponse2.status === 400) {
      console.log('✅ Validación funcionó correctamente - se rechazó keyframe después del período');
      console.log('📝 Mensaje de error:', JSON.parse(createInvalidKeyframeResponse2.data).message);
    } else {
      console.log('❌ La validación no funcionó como esperado:', createInvalidKeyframeResponse2.data);
    }
    
    // 5. Limpiar datos de prueba
    console.log('\n5️⃣ Limpiando datos de prueba...');
    const deleteOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/operational-periods/${period.id}`,
      method: 'DELETE'
    };
    
    const deleteResponse = await new Promise((resolve, reject) => {
      const req = http.request(deleteOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.end();
    });
    
    if (deleteResponse.status === 200) {
      console.log('✅ Datos de prueba eliminados correctamente');
    } else {
      console.log('⚠️  Error al eliminar datos de prueba');
    }
    
    console.log('\n🎉 Prueba de validaciones completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testKeyframeValidation(); 