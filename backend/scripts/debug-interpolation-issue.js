const http = require('http');

async function debugInterpolationIssue() {
  try {
    console.log('🔍 Diagnosticando problema de interpolación desde apertura...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional simple
    console.log('\n1️⃣ Creando período operacional simple...');
    
    const periodData = JSON.stringify({
      startDate: '2024-07-01',
      endDate: '2024-07-10',
      label: 'Debug Interpolación'
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
    
    // 2. Crear keyframes específicos para el test
    console.log('\n2️⃣ Creando keyframes específicos...');
    
    const keyframes = [
      { date: '2024-07-03', basePrice: 8000 },  // Primer keyframe normal
      { date: '2024-07-07', basePrice: 15000 }, // Segundo keyframe normal
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
      });
      
      if (createKeyframeResponse.status === 201) {
        console.log(`✅ Keyframe creado: ${keyframe.date} - $${keyframe.basePrice}`);
      } else {
        console.log(`❌ Error al crear keyframe: ${keyframe.date}`);
      }
    }
    
    // 3. Obtener todos los keyframes y analizar
    console.log('\n3️⃣ Analizando keyframes del período...');
    
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
      const periodStart = new Date('2024-07-01');
      const periodEnd = new Date('2024-07-10');
      
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
      
      // Simular la lógica de interpolación del frontend
      console.log('\n4️⃣ Simulando lógica de interpolación...');
      
      if (sortedPeriodKeyframes.length > 1) {
        console.log(`🔍 Generando curva con ${sortedPeriodKeyframes.length - 1} segmentos`);
        
        for (let i = 0; i < sortedPeriodKeyframes.length - 1; i++) {
          const a = sortedPeriodKeyframes[i], b = sortedPeriodKeyframes[i + 1];
          const aDate = new Date(a.date);
          const bDate = new Date(b.date);
          
          console.log(`🔍 Segmento ${i + 1}:`);
          console.log(`   Desde: ${aDate.toISOString().split('T')[0]} - ${a.isOperational ? a.operationalType : 'NORMAL'} - $${a.basePrice}`);
          console.log(`   Hasta: ${bDate.toISOString().split('T')[0]} - ${b.isOperational ? b.operationalType : 'NORMAL'} - $${b.basePrice}`);
          
          // Simular interpolación
          const steps = 5; // Menos pasos para debug
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const interpolatedDate = new Date(aDate.getTime() + (bDate.getTime() - aDate.getTime()) * t);
            const interpolatedPrice = a.basePrice + (b.basePrice - a.basePrice) * t;
            
            console.log(`   Paso ${s}: ${interpolatedDate.toISOString().split('T')[0]} - $${Math.round(interpolatedPrice)}`);
          }
        }
      } else {
        console.log(`❌ No hay suficientes keyframes para generar curva (${sortedPeriodKeyframes.length})`);
      }
      
      // Verificar si hay keyframes operacionales
      const operationalKeyframes = sortedPeriodKeyframes.filter(k => k.isOperational);
      const normalKeyframes = sortedPeriodKeyframes.filter(k => !k.isOperational);
      
      console.log(`\n📊 Resumen:`);
      console.log(`   Keyframes operacionales: ${operationalKeyframes.length}`);
      console.log(`   Keyframes normales: ${normalKeyframes.length}`);
      console.log(`   Total: ${sortedPeriodKeyframes.length}`);
      
      if (operationalKeyframes.length === 0) {
        console.log(`❌ PROBLEMA: No hay keyframes operacionales en el período`);
        console.log(`   Esto explicaría por qué la línea no conecta desde la apertura`);
      } else {
        console.log(`✅ Hay keyframes operacionales`);
        operationalKeyframes.forEach((k, i) => {
          const dateStr = new Date(k.date).toISOString().split('T')[0];
          console.log(`   ${i + 1}. ${dateStr} - ${k.operationalType} - $${k.basePrice}`);
        });
      }
    }
    
    // 4. Limpiar datos de prueba
    console.log('\n5️⃣ Limpiando datos de prueba...');
    
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
    
    console.log('\n🎉 Diagnóstico completado!');
    console.log('\n📝 Verifica en la consola del navegador los logs de debug');
    console.log('   para ver si los keyframes operacionales se están incluyendo');
    console.log('   en la interpolación del frontend.');
    
  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error);
  }
}

debugInterpolationIssue(); 