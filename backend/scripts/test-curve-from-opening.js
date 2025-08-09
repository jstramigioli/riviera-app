const http = require('http');

async function testCurveFromOpening() {
  try {
    console.log('🧪 Probando que las curvas comiencen desde el keyframe de apertura...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional
    console.log('\n1️⃣ Creando período operacional...');
    
    const periodData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-06-20',
      label: 'Test Curva desde Apertura'
    });
    
    const createPeriodResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${hotelId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(periodData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.write(periodData);
      req.end();
    });
    
    if (createPeriodResponse.status !== 201) {
      console.error('❌ Error al crear período:', createPeriodResponse.data);
      return;
    }
    
    const period = JSON.parse(createPeriodResponse.data);
    console.log(`✅ Período creado: ${period.id}`);
    console.log(`📅 Fechas del período: ${period.startDate} a ${period.endDate}`);
    
    // 2. Crear keyframes dentro del período (después de la apertura)
    console.log('\n2️⃣ Creando keyframes dentro del período...');
    
    const keyframes = [
      { date: '2024-06-05', basePrice: 8000 },
      { date: '2024-06-10', basePrice: 8500 },
      { date: '2024-06-15', basePrice: 9000 }
    ];
    
    for (const keyframe of keyframes) {
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
    
    // 3. Verificar todos los keyframes del período
    console.log('\n3️⃣ Verificando keyframes del período...');
    
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
      
      // Filtrar keyframes del período específico
      const periodStart = new Date('2024-06-01');
      const periodEnd = new Date('2024-06-20');
      
      const periodKeyframes = allKeyframes.filter(k => {
        const keyframeDate = new Date(k.date);
        return keyframeDate >= periodStart && keyframeDate <= periodEnd;
      });
      
      // Ordenar por fecha
      const sortedPeriodKeyframes = periodKeyframes.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`📊 Keyframes en el período (${periodKeyframes.length}):`);
      sortedPeriodKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        const typeStr = k.isOperational ? (k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE') : 'NORMAL';
        console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${k.basePrice}`);
      });
      
      // Verificar que el primer keyframe sea de apertura
      const firstKeyframe = sortedPeriodKeyframes[0];
      if (firstKeyframe && firstKeyframe.isOperational && firstKeyframe.operationalType === 'opening') {
        console.log('✅ El primer keyframe es de apertura - la curva debería comenzar desde aquí');
      } else {
        console.log('❌ El primer keyframe NO es de apertura');
      }
      
      // Verificar que el último keyframe sea de cierre
      const lastKeyframe = sortedPeriodKeyframes[sortedPeriodKeyframes.length - 1];
      if (lastKeyframe && lastKeyframe.isOperational && lastKeyframe.operationalType === 'closing') {
        console.log('✅ El último keyframe es de cierre - la curva debería terminar aquí');
      } else {
        console.log('❌ El último keyframe NO es de cierre');
      }
    }
    
    // 4. Limpiar datos de prueba
    console.log('\n4️⃣ Limpiando datos de prueba...');
    
    const deleteResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${period.id}`,
        method: 'DELETE'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.end();
    });
    
    if (deleteResponse.status === 200) {
      console.log('✅ Datos de prueba eliminados correctamente');
    } else {
      console.log('⚠️  Error al eliminar datos de prueba');
    }
    
    console.log('\n🎉 Prueba completada!');
    console.log('\n📝 Verifica en el frontend que:');
    console.log('   1. La curva comience desde el keyframe de apertura (2024-06-01)');
    console.log('   2. La curva termine en el keyframe de cierre (2024-06-20)');
    console.log('   3. No haya línea continua entre períodos operacionales');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testCurveFromOpening(); 