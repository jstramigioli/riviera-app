const http = require('http');

async function testCurveDebug() {
  try {
    console.log('🧪 Probando curvas con eje Y desde 0 y interpolación desde apertura...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional
    console.log('\n1️⃣ Creando período operacional...');
    
    const periodData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-06-15',
      label: 'Test Debug Curva'
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
    
    // 2. Crear keyframes con valores variados para probar el eje Y
    console.log('\n2️⃣ Creando keyframes con valores variados...');
    
    const keyframes = [
      { date: '2024-06-03', basePrice: 5000 },  // Valor bajo
      { date: '2024-06-07', basePrice: 12000 }, // Valor alto
      { date: '2024-06-12', basePrice: 8000 }   // Valor medio
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
      const periodEnd = new Date('2024-06-15');
      
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
        console.log('✅ El primer keyframe es de apertura');
      } else {
        console.log('❌ El primer keyframe NO es de apertura');
      }
      
      // Verificar que el último keyframe sea de cierre
      const lastKeyframe = sortedPeriodKeyframes[sortedPeriodKeyframes.length - 1];
      if (lastKeyframe && lastKeyframe.isOperational && lastKeyframe.operationalType === 'closing') {
        console.log('✅ El último keyframe es de cierre');
      } else {
        console.log('❌ El último keyframe NO es de cierre');
      }
      
      // Verificar valores para el eje Y
      const normalKeyframes = sortedPeriodKeyframes.filter(k => !k.isOperational);
      if (normalKeyframes.length > 0) {
        const values = normalKeyframes.map(k => k.basePrice);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        console.log(`📈 Rango de valores: $${minValue} - $${maxValue}`);
        console.log(`📊 Con eje Y desde 0: 0 - $${maxValue}`);
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
    console.log('   1. El eje Y comience en 0 pesos');
    console.log('   2. La curva comience desde el keyframe de apertura');
    console.log('   3. La curva conecte todos los keyframes del período');
    console.log('   4. Los logs de debug muestren la interpolación correcta');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testCurveDebug(); 