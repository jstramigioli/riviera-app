const http = require('http');

async function testCurveSegments() {
  try {
    console.log('🧪 Probando segmentos de curva entre períodos operacionales...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear dos períodos operacionales separados
    console.log('\n1️⃣ Creando períodos operacionales separados...');
    
    // Primer período
    const period1Data = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-06-15',
      label: 'Período 1'
    });
    
    const createPeriod1Response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${hotelId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(period1Data)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.write(period1Data);
      req.end();
    });
    
    if (createPeriod1Response.status !== 201) {
      console.error('❌ Error al crear período 1:', createPeriod1Response.data);
      return;
    }
    
    const period1 = JSON.parse(createPeriod1Response.data);
    console.log(`✅ Período 1 creado: ${period1.id}`);
    
    // Segundo período (con gap entre períodos)
    const period2Data = JSON.stringify({
      startDate: '2024-07-01',
      endDate: '2024-07-15',
      label: 'Período 2'
    });
    
    const createPeriod2Response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${hotelId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(period2Data)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.write(period2Data);
      req.end();
    });
    
    if (createPeriod2Response.status !== 201) {
      console.error('❌ Error al crear período 2:', createPeriod2Response.data);
      return;
    }
    
    const period2 = JSON.parse(createPeriod2Response.data);
    console.log(`✅ Período 2 creado: ${period2.id}`);
    
    // 2. Crear keyframes en cada período
    console.log('\n2️⃣ Creando keyframes en cada período...');
    
    // Keyframes para período 1
    const keyframes1 = [
      { date: '2024-06-05', basePrice: 8000 },
      { date: '2024-06-10', basePrice: 8500 },
      { date: '2024-06-12', basePrice: 9000 }
    ];
    
    for (const keyframe of keyframes1) {
      const keyframeData = JSON.stringify({
        date: keyframe.date,
        basePrice: keyframe.basePrice,
        isOperational: false
      });
      
      const createKeyframeResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3001,
          path: `/api/dynamic-pricing/keyframes/${hotelId}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(keyframeData)
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
        });
        
        req.on('error', (err) => { reject(err); });
        req.write(keyframeData);
        req.end();
      });
      
      if (createKeyframeResponse.status === 201) {
        console.log(`✅ Keyframe creado: ${keyframe.date} - $${keyframe.basePrice}`);
      } else {
        console.log(`❌ Error al crear keyframe: ${keyframe.date}`);
      }
    }
    
    // Keyframes para período 2
    const keyframes2 = [
      { date: '2024-07-05', basePrice: 7500 },
      { date: '2024-07-10', basePrice: 8000 },
      { date: '2024-07-12', basePrice: 8500 }
    ];
    
    for (const keyframe of keyframes2) {
      const keyframeData = JSON.stringify({
        date: keyframe.date,
        basePrice: keyframe.basePrice,
        isOperational: false
      });
      
      const createKeyframeResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3001,
          path: `/api/dynamic-pricing/keyframes/${hotelId}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(keyframeData)
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
        });
        
        req.on('error', (err) => { reject(err); });
        req.write(keyframeData);
        req.end();
      });
      
      if (createKeyframeResponse.status === 201) {
        console.log(`✅ Keyframe creado: ${keyframe.date} - $${keyframe.basePrice}`);
      } else {
        console.log(`❌ Error al crear keyframe: ${keyframe.date}`);
      }
    }
    
    // 3. Verificar keyframes creados
    console.log('\n3️⃣ Verificando keyframes creados...');
    
    const getKeyframesResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/dynamic-pricing/keyframes/${hotelId}`,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.end();
    });
    
    if (getKeyframesResponse.status === 200) {
      const allKeyframes = JSON.parse(getKeyframesResponse.data);
      const normalKeyframes = allKeyframes.filter(k => !k.isOperational);
      const operationalKeyframes = allKeyframes.filter(k => k.isOperational);
      
      console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
      console.log(`📈 Keyframes normales: ${normalKeyframes.length}`);
      console.log(`🔧 Keyframes operacionales: ${operationalKeyframes.length}`);
      
      console.log('\n📈 Keyframes normales por fecha:');
      normalKeyframes.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - $${k.basePrice}`);
      });
      
      console.log('\n🔧 Keyframes operacionales:');
      operationalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        const typeStr = k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
        console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${k.basePrice}`);
      });
    }
    
    // 4. Limpiar datos de prueba
    console.log('\n4️⃣ Limpiando datos de prueba...');
    
    // Eliminar períodos (esto también eliminará los keyframes)
    const deletePeriod1Response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${period1.id}`,
        method: 'DELETE'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.end();
    });
    
    const deletePeriod2Response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${period2.id}`,
        method: 'DELETE'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.end();
    });
    
    if (deletePeriod1Response.status === 200 && deletePeriod2Response.status === 200) {
      console.log('✅ Datos de prueba eliminados correctamente');
    } else {
      console.log('⚠️  Error al eliminar datos de prueba');
    }
    
    console.log('\n🎉 Prueba de segmentos de curva completada!');
    console.log('\n📝 Nota: Verifica en el frontend que las curvas se corten entre períodos operacionales.');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testCurveSegments(); 