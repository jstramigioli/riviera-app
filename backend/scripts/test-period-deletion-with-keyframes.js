const http = require('http');

async function testPeriodDeletionWithKeyframes() {
  try {
    console.log('🧪 Probando eliminación de período con keyframes...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional de prueba
    console.log('\n1️⃣ Creando período operacional de prueba...');
    
    const periodData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      label: 'Test Eliminación con Keyframes'
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
    
    // 2. Crear varios keyframes dentro del período
    console.log('\n2️⃣ Creando keyframes dentro del período...');
    
    const keyframeDates = [
      '2024-06-15',
      '2024-07-01',
      '2024-07-15',
      '2024-08-01',
      '2024-08-15'
    ];
    
    const createdKeyframes = [];
    
    for (const date of keyframeDates) {
      const keyframeData = JSON.stringify({
        date: date,
        basePrice: 8000 + Math.floor(Math.random() * 2000),
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
      
      if (createKeyframeResponse.status === 201) {
        const keyframe = JSON.parse(createKeyframeResponse.data);
        createdKeyframes.push(keyframe);
        console.log(`✅ Keyframe creado: ${date} - $${keyframe.basePrice}`);
      } else {
        console.log(`❌ Error al crear keyframe para ${date}:`, createKeyframeResponse.data);
      }
    }
    
    console.log(`📊 Total de keyframes creados: ${createdKeyframes.length}`);
    
    // 3. Verificar todos los keyframes antes de eliminar el período
    console.log('\n3️⃣ Verificando keyframes antes de eliminar el período...');
    
    const getKeyframesOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'GET'
    };
    
    const getKeyframesResponse = await new Promise((resolve, reject) => {
      const req = http.request(getKeyframesOptions, (res) => {
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
    
    if (getKeyframesResponse.status === 200) {
      const allKeyframes = JSON.parse(getKeyframesResponse.data);
      const operationalKeyframes = allKeyframes.filter(k => k.isOperational);
      const normalKeyframes = allKeyframes.filter(k => !k.isOperational);
      
      console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
      console.log(`🔧 Keyframes operacionales: ${operationalKeyframes.length}`);
      console.log(`📈 Keyframes normales: ${normalKeyframes.length}`);
      
      normalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - $${k.basePrice}`);
      });
    }
    
    // 4. Eliminar el período operacional
    console.log('\n4️⃣ Eliminando período operacional...');
    
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
      console.log('✅ Período eliminado correctamente');
    } else {
      console.log('❌ Error al eliminar período:', deleteResponse.data);
    }
    
    // 5. Verificar que todos los keyframes fueron eliminados
    console.log('\n5️⃣ Verificando que todos los keyframes fueron eliminados...');
    
    const getKeyframesAfterResponse = await new Promise((resolve, reject) => {
      const req = http.request(getKeyframesOptions, (res) => {
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
    
    if (getKeyframesAfterResponse.status === 200) {
      const allKeyframesAfter = JSON.parse(getKeyframesAfterResponse.data);
      const operationalKeyframesAfter = allKeyframesAfter.filter(k => k.isOperational);
      const normalKeyframesAfter = allKeyframesAfter.filter(k => !k.isOperational);
      
      console.log(`📊 Total de keyframes después: ${allKeyframesAfter.length}`);
      console.log(`🔧 Keyframes operacionales después: ${operationalKeyframesAfter.length}`);
      console.log(`📈 Keyframes normales después: ${normalKeyframesAfter.length}`);
      
      if (normalKeyframesAfter.length === 0 && operationalKeyframesAfter.length === 0) {
        console.log('✅ Todos los keyframes fueron eliminados correctamente');
      } else {
        console.log('❌ No todos los keyframes fueron eliminados');
        if (normalKeyframesAfter.length > 0) {
          console.log('⚠️  Keyframes normales restantes:');
          normalKeyframesAfter.forEach((k, i) => {
            const dateStr = new Date(k.date).toISOString().split('T')[0];
            console.log(`   ${i + 1}. ${dateStr} - $${k.basePrice}`);
          });
        }
        if (operationalKeyframesAfter.length > 0) {
          console.log('⚠️  Keyframes operacionales restantes:');
          operationalKeyframesAfter.forEach((k, i) => {
            const dateStr = new Date(k.date).toISOString().split('T')[0];
            console.log(`   ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
          });
        }
      }
    }
    
    console.log('\n🎉 Prueba de eliminación completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testPeriodDeletionWithKeyframes(); 