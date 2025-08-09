const http = require('http');

async function testFrontendKeyframeCreation() {
  try {
    console.log('🧪 Probando creación de keyframes desde el frontend...');
    
    const hotelId = 'default-hotel';
    
    // 1. Verificar keyframes existentes
    console.log('\n1️⃣ Verificando keyframes existentes...');
    
    const getOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'GET'
    };
    
    const keyframesResponse = await new Promise((resolve, reject) => {
      const req = http.request(getOptions, (res) => {
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
    
    if (keyframesResponse.status !== 200) {
      console.error('❌ Error al obtener keyframes:', keyframesResponse.data);
      return;
    }
    
    const keyframes = JSON.parse(keyframesResponse.data);
    console.log(`✅ Keyframes existentes: ${keyframes.length}`);
    
    // 2. Crear un keyframe de prueba
    console.log('\n2️⃣ Creando keyframe de prueba...');
    
    const testKeyframe = {
      date: '2024-07-15T12:00:00.000Z',
      basePrice: 12000,
      isOperational: false,
      operationalType: null,
      periodId: null
    };
    
    const postOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(testKeyframe))
      }
    };
    
    const createResponse = await new Promise((resolve, reject) => {
      const req = http.request(postOptions, (res) => {
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
      
      req.write(JSON.stringify(testKeyframe));
      req.end();
    });
    
    if (createResponse.status !== 201) {
      console.error('❌ Error al crear keyframe:', createResponse.data);
      return;
    }
    
    const newKeyframe = JSON.parse(createResponse.data);
    console.log(`✅ Keyframe creado: ${newKeyframe.id}`);
    console.log(`📅 Fecha: ${newKeyframe.date}`);
    console.log(`💰 Precio: $${newKeyframe.basePrice}`);
    
    // 3. Verificar que se agregó correctamente
    console.log('\n3️⃣ Verificando que el keyframe se agregó...');
    
    const verifyResponse = await new Promise((resolve, reject) => {
      const req = http.request(getOptions, (res) => {
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
    
    if (verifyResponse.status !== 200) {
      console.error('❌ Error al verificar keyframes:', verifyResponse.data);
      return;
    }
    
    const updatedKeyframes = JSON.parse(verifyResponse.data);
    const newKeyframeFound = updatedKeyframes.find(k => k.id === newKeyframe.id);
    
    if (newKeyframeFound) {
      console.log('✅ Keyframe encontrado en la lista actualizada');
    } else {
      console.log('❌ Keyframe no encontrado en la lista actualizada');
    }
    
    // 4. Eliminar el keyframe de prueba
    console.log('\n4️⃣ Eliminando keyframe de prueba...');
    
    const deleteOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${newKeyframe.id}`,
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
      console.log('✅ Keyframe eliminado correctamente');
    } else {
      console.log('⚠️  Error al eliminar keyframe');
    }
    
    console.log('\n🎉 Prueba completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testFrontendKeyframeCreation(); 