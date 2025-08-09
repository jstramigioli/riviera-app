const http = require('http');

async function verifyCurrentData() {
  try {
    console.log('🔍 Verificando estado actual de los datos...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Obtener todos los períodos operacionales
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
      console.log(`📊 Períodos operacionales encontrados: ${periods.length}`);
      periods.forEach((period, i) => {
        console.log(`   ${i + 1}. ${period.startDate} a ${period.endDate} - ${period.label || 'Sin etiqueta'}`);
      });
    } else {
      console.log('❌ Error al obtener períodos operacionales');
    }
    
    // 2. Obtener todos los keyframes
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
      
      // Separar keyframes por tipo
      const operationalKeyframes = allKeyframes.filter(k => k.isOperational);
      const normalKeyframes = allKeyframes.filter(k => !k.isOperational);
      
      console.log(`📊 Keyframes operacionales: ${operationalKeyframes.length}`);
      operationalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
      });
      
      console.log(`📊 Keyframes normales: ${normalKeyframes.length}`);
      normalKeyframes.forEach((k, i) => {
        const dateStr = new Date(k.date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${dateStr} - $${k.basePrice}`);
      });
      
      // 3. Verificar si hay períodos sin keyframes operacionales
      if (getPeriodsResponse.status === 200) {
        const periods = JSON.parse(getPeriodsResponse.data);
        console.log('\n3️⃣ Verificando períodos sin keyframes operacionales...');
        
        periods.forEach((period, periodIndex) => {
          const periodStart = new Date(period.startDate);
          const periodEnd = new Date(period.endDate);
          
          const periodKeyframes = allKeyframes.filter(k => {
            const keyframeDate = new Date(k.date);
            return keyframeDate >= periodStart && keyframeDate <= periodEnd;
          });
          
          const periodOperationalKeyframes = periodKeyframes.filter(k => k.isOperational);
          
          console.log(`📊 Período ${periodIndex + 1} (${period.startDate} a ${period.endDate}):`);
          console.log(`   Keyframes totales: ${periodKeyframes.length}`);
          console.log(`   Keyframes operacionales: ${periodOperationalKeyframes.length}`);
          
          if (periodOperationalKeyframes.length === 0) {
            console.log(`   ❌ PROBLEMA: No hay keyframes operacionales en este período`);
          } else {
            console.log(`   ✅ OK: Hay keyframes operacionales`);
            periodOperationalKeyframes.forEach((k, i) => {
              const dateStr = new Date(k.date).toISOString().split('T')[0];
              console.log(`     ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
            });
          }
        });
      }
    } else {
      console.log('❌ Error al obtener keyframes');
    }
    
    console.log('\n🎉 Verificación completada!');
    console.log('\n📝 Si hay períodos sin keyframes operacionales,');
    console.log('   eso explicaría por qué la línea no conecta desde la apertura.');
    console.log('\n🔧 Solución: Eliminar y recrear los períodos problemáticos.');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

verifyCurrentData(); 