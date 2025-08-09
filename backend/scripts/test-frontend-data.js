const http = require('http');

async function testFrontendData() {
  try {
    console.log('🧪 Generando datos para verificar comportamiento del frontend...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional
    console.log('\n1️⃣ Creando período operacional...');
    
    const periodData = JSON.stringify({
      startDate: '2024-08-01',
      endDate: '2024-08-20',
      label: 'Test Frontend Data'
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
    
    // 2. Crear keyframes con valores muy diferentes para hacer el problema más visible
    console.log('\n2️⃣ Creando keyframes con valores muy diferentes...');
    
    const keyframes = [
      { date: '2024-08-05', basePrice: 3000 },   // Valor muy bajo
      { date: '2024-08-10', basePrice: 20000 },  // Valor muy alto
      { date: '2024-08-15', basePrice: 7000 }    // Valor medio
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
    
    // 3. Verificar la estructura final
    console.log('\n3️⃣ Verificando estructura final...');
    
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
      const periodStart = new Date('2024-08-01');
      const periodEnd = new Date('2024-08-20');
      
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
      
      // Verificar valores para el eje Y
      const normalKeyframes = sortedPeriodKeyframes.filter(k => !k.isOperational);
      if (normalKeyframes.length > 0) {
        const values = normalKeyframes.map(k => k.basePrice);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        console.log(`📈 Rango de valores normales: $${minValue} - $${maxValue}`);
        console.log(`📊 Con eje Y desde 0: 0 - $${maxValue}`);
        console.log(`🔍 Diferencia: ${maxValue - minValue} pesos`);
      }
      
      // Verificar keyframes operacionales
      const operationalKeyframes = sortedPeriodKeyframes.filter(k => k.isOperational);
      console.log(`📊 Keyframes operacionales: ${operationalKeyframes.length}`);
      operationalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
      });
    }
    
    console.log('\n🎉 Datos de prueba creados!');
    console.log('\n📝 Instrucciones para verificar:');
    console.log('   1. Ve al frontend y navega a Configuración > Curva Estacional');
    console.log('   2. Abre la consola del navegador (F12)');
    console.log('   3. Busca los logs que empiecen con 🔍');
    console.log('   4. Verifica que:');
    console.log('      - El eje Y comience en 0 pesos');
    console.log('      - La curva comience desde el keyframe de apertura (2024-08-01)');
    console.log('      - La curva conecte todos los keyframes del período');
    console.log('      - Los logs muestren "Interpolando entre" para cada segmento');
    console.log('\n🔍 Si la línea no conecta desde la apertura, verifica:');
    console.log('   - Que los logs muestren el keyframe de apertura en la lista');
    console.log('   - Que aparezca "Generando curva con X segmentos"');
    console.log('   - Que aparezca "Interpolando entre" para el primer segmento');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testFrontendData(); 