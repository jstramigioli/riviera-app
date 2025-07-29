const http = require('http');

async function cleanAndTest() {
  try {
    console.log('🧹 Limpiando datos y creando entorno de prueba limpio...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Obtener todos los períodos operacionales para eliminarlos
    console.log('\n1️⃣ Obteniendo períodos operacionales para eliminar...');
    
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
      console.log(`📊 Períodos encontrados para eliminar: ${periods.length}`);
      
      // 2. Eliminar todos los períodos operacionales
      console.log('\n2️⃣ Eliminando períodos operacionales...');
      
      for (const period of periods) {
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
          console.log(`✅ Período eliminado: ${period.startDate} a ${period.endDate}`);
        } else {
          console.log(`❌ Error al eliminar período: ${period.startDate} a ${period.endDate}`);
        }
      }
    }
    
    // 3. Verificar que no queden keyframes
    console.log('\n3️⃣ Verificando que no queden keyframes...');
    
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
      console.log(`📊 Keyframes restantes: ${allKeyframes.length}`);
      
      if (allKeyframes.length > 0) {
        console.log('⚠️  Aún quedan keyframes. Eliminándolos...');
        
        for (const keyframe of allKeyframes) {
          const deleteResponse = await new Promise((resolve, reject) => {
            const req = http.request({
              hostname: 'localhost',
              port: 3001,
              path: `/api/dynamic-pricing/keyframes/${keyframe.id}`,
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
            console.log(`✅ Keyframe eliminado: ${new Date(keyframe.date).toISOString().split('T')[0]}`);
          }
        }
      } else {
        console.log('✅ No quedan keyframes');
      }
    }
    
    // 4. Crear un período operacional limpio
    console.log('\n4️⃣ Creando período operacional limpio...');
    
    const periodData = JSON.stringify({
      startDate: '2024-09-01',
      endDate: '2024-09-15',
      label: 'Test Limpio'
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
    
    // 5. Crear keyframes de prueba
    console.log('\n5️⃣ Creando keyframes de prueba...');
    
    const keyframes = [
      { date: '2024-09-05', basePrice: 5000 },
      { date: '2024-09-10', basePrice: 15000 },
      { date: '2024-09-12', basePrice: 8000 }
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
    
    // 6. Verificar el resultado final
    console.log('\n6️⃣ Verificando resultado final...');
    
    const finalKeyframesResponse = await new Promise((resolve, reject) => {
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
    
    if (finalKeyframesResponse.status === 200) {
      const allKeyframes = JSON.parse(finalKeyframesResponse.data);
      
      // Filtrar keyframes del período específico
      const periodStart = new Date('2024-09-01');
      const periodEnd = new Date('2024-09-15');
      
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
    }
    
    console.log('\n🎉 Entorno de prueba limpio creado!');
    console.log('\n📝 Instrucciones:');
    console.log('   1. Ve al frontend y navega a Configuración > Curva Estacional');
    console.log('   2. Abre la consola del navegador (F12)');
    console.log('   3. Busca los logs que empiecen con 🔍');
    console.log('   4. Verifica que la curva comience desde el keyframe de apertura');
    console.log('   5. Verifica que el eje Y comience en 0 pesos');
    
  } catch (error) {
    console.error('❌ Error en la limpieza:', error);
  }
}

cleanAndTest(); 