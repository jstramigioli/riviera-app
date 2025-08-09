const http = require('http');

async function testKeyframeUpdateValidation() {
  try {
    console.log('🧪 Probando validaciones de actualización de keyframes...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional de prueba
    console.log('\n1️⃣ Creando período operacional de prueba...');
    
    const periodData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      label: 'Test Actualización Keyframes'
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
    
    // 2. Crear un keyframe dentro del período
    console.log('\n2️⃣ Creando keyframe dentro del período...');
    
    const keyframeData = JSON.stringify({
      date: '2024-07-15',
      basePrice: 8500,
      isOperational: false
    });
    
    const createKeyframeOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(keyframeData)
      }
    };
    
    const createKeyframeResponse = await new Promise((resolve, reject) => {
      const req = http.request(createKeyframeOptions, (res) => {
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
      
      req.write(keyframeData);
      req.end();
    });
    
    if (createKeyframeResponse.status !== 201) {
      console.error('❌ Error al crear keyframe:', createKeyframeResponse.data);
      return;
    }
    
    const keyframe = JSON.parse(createKeyframeResponse.data);
    console.log(`✅ Keyframe creado: ${keyframe.id}`);
    
    // 3. Intentar mover el keyframe DENTRO del período (debería funcionar)
    console.log('\n3️⃣ Probando mover keyframe DENTRO del período (debería funcionar)...');
    
    const updateValidData = JSON.stringify({
      date: '2024-07-20',
      basePrice: 9000
    });
    
    const updateValidOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${keyframe.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateValidData)
      }
    };
    
    const updateValidResponse = await new Promise((resolve, reject) => {
      const req = http.request(updateValidOptions, (res) => {
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
      
      req.write(updateValidData);
      req.end();
    });
    
    if (updateValidResponse.status === 200) {
      console.log('✅ Keyframe actualizado correctamente dentro del período');
    } else {
      console.log('❌ Error al actualizar keyframe dentro del período:', updateValidResponse.data);
    }
    
    // 4. Intentar mover el keyframe FUERA del período (debería fallar)
    console.log('\n4️⃣ Probando mover keyframe FUERA del período (debería fallar)...');
    
    const updateInvalidData = JSON.stringify({
      date: '2024-05-15', // Antes del período
      basePrice: 9000
    });
    
    const updateInvalidOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${keyframe.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateInvalidData)
      }
    };
    
    const updateInvalidResponse = await new Promise((resolve, reject) => {
      const req = http.request(updateInvalidOptions, (res) => {
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
      
      req.write(updateInvalidData);
      req.end();
    });
    
    if (updateInvalidResponse.status === 400) {
      console.log('✅ Validación funcionó correctamente - se rechazó mover keyframe fuera del período');
      console.log('📝 Mensaje de error:', JSON.parse(updateInvalidResponse.data).message);
    } else {
      console.log('❌ La validación no funcionó como esperado:', updateInvalidResponse.data);
    }
    
    // 5. Intentar mover el keyframe DESPUÉS del período (debería fallar)
    console.log('\n5️⃣ Probando mover keyframe DESPUÉS del período (debería fallar)...');
    
    const updateInvalidData2 = JSON.stringify({
      date: '2024-09-15', // Después del período
      basePrice: 9000
    });
    
    const updateInvalidOptions2 = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${keyframe.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateInvalidData2)
      }
    };
    
    const updateInvalidResponse2 = await new Promise((resolve, reject) => {
      const req = http.request(updateInvalidOptions2, (res) => {
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
      
      req.write(updateInvalidData2);
      req.end();
    });
    
    if (updateInvalidResponse2.status === 400) {
      console.log('✅ Validación funcionó correctamente - se rechazó mover keyframe después del período');
      console.log('📝 Mensaje de error:', JSON.parse(updateInvalidResponse2.data).message);
    } else {
      console.log('❌ La validación no funcionó como esperado:', updateInvalidResponse2.data);
    }
    
    // 6. Limpiar datos de prueba
    console.log('\n6️⃣ Limpiando datos de prueba...');
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
    
    console.log('\n🎉 Prueba de validaciones de actualización completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testKeyframeUpdateValidation(); 