const http = require('http');

async function verifyTestData() {
  try {
    console.log('🔍 Verificando datos de prueba...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Obtener períodos operacionales
    console.log('\n1️⃣ Obteniendo períodos operacionales...');
    
    const getPeriodsResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/operational-periods/${hotelId}`,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve({ status: res.statusCode, data: data }); });
      });
      
      req.on('error', (err) => { reject(err); });
      req.end();
    });
    
    if (getPeriodsResponse.status === 200) {
      const periods = JSON.parse(getPeriodsResponse.data);
      console.log(`📊 Períodos operacionales: ${periods.length}`);
      periods.forEach((period, i) => {
        console.log(`   ${i + 1}. ${period.startDate} a ${period.endDate} - ${period.label || 'Sin etiqueta'}`);
      });
    }
    
    // 2. Obtener keyframes
    console.log('\n2️⃣ Obteniendo keyframes...');
    
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
      console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
      
      // Filtrar keyframes del período de prueba
      const periodStart = new Date('2024-09-01');
      const periodEnd = new Date('2024-09-15');
      
      const periodKeyframes = allKeyframes.filter(k => {
        const keyframeDate = new Date(k.date);
        return keyframeDate >= periodStart && keyframeDate <= periodEnd;
      });
      
      // Ordenar por fecha
      const sortedPeriodKeyframes = periodKeyframes.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`📊 Keyframes en el período de prueba (${periodKeyframes.length}):`);
      sortedPeriodKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        const typeStr = k.isOperational ? (k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE') : 'NORMAL';
        console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${k.basePrice}`);
      });
      
      // Verificar valores para el eje Y
      const normalKeyframes = sortedPeriodKeyframes.filter(k => !k.isOperational);
      if (normalKeyframes.length > 0) {
        const values = normalKeyframes.map(k => k.basePrice);
        const minValue = 0; // Como en el frontend
        const maxValue = Math.max(...values);
        console.log(`📈 Valores normales: [${values.join(', ')}]`);
        console.log(`📊 Eje Y: ${minValue} - ${maxValue}`);
        console.log(`🔍 Diferencia: ${maxValue - minValue} pesos`);
      }
      
      // Verificar keyframes operacionales
      const operationalKeyframes = sortedPeriodKeyframes.filter(k => k.isOperational);
      console.log(`📊 Keyframes operacionales: ${operationalKeyframes.length}`);
      operationalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
      });
      
      // Simular interpolación para verificar
      console.log('\n3️⃣ Simulando interpolación...');
      
      if (sortedPeriodKeyframes.length > 1) {
        console.log(`🔍 Generando curva con ${sortedPeriodKeyframes.length - 1} segmentos`);
        
        for (let i = 0; i < sortedPeriodKeyframes.length - 1; i++) {
          const a = sortedPeriodKeyframes[i], b = sortedPeriodKeyframes[i + 1];
          const aDate = new Date(a.date);
          const bDate = new Date(b.date);
          
          console.log(`🔍 Segmento ${i + 1}:`);
          console.log(`   Desde: ${aDate.toISOString().split('T')[0]} - ${a.isOperational ? a.operationalType : 'NORMAL'} - $${a.basePrice}`);
          console.log(`   Hasta: ${bDate.toISOString().split('T')[0]} - ${b.isOperational ? b.operationalType : 'NORMAL'} - $${b.basePrice}`);
          
          // Simular algunos puntos de interpolación
          const steps = 3; // Solo 3 pasos para debug
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const interpolatedDate = new Date(aDate.getTime() + (bDate.getTime() - aDate.getTime()) * t);
            const interpolatedPrice = a.basePrice + (b.basePrice - a.basePrice) * t;
            
            console.log(`   Paso ${s}: ${interpolatedDate.toISOString().split('T')[0]} - $${Math.round(interpolatedPrice)}`);
          }
        }
      }
    }
    
    console.log('\n🎉 Verificación completada!');
    console.log('\n📝 Ahora ve al frontend y verifica:');
    console.log('   1. Que aparezcan los logs de debug en la consola');
    console.log('   2. Que los valores de minValue y maxValue sean correctos');
    console.log('   3. Que las coordenadas X,Y de los puntos estén dentro del área visible');
    console.log('   4. Que la línea azul sea visible entre los keyframes');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

verifyTestData(); 