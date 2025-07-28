const http = require('http');

async function testPeriodCreationNoDuplicates() {
  try {
    console.log('🧪 Probando creación de período sin duplicados...');
    
    const hotelId = 'default-hotel';
    
    // 1. Verificar keyframes antes de crear el período
    console.log('\n1️⃣ Verificando keyframes antes de crear período...');
    
    const getOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'GET'
    };
    
    const beforeResponse = await new Promise((resolve, reject) => {
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
    
    if (beforeResponse.status !== 200) {
      console.error('❌ Error al obtener keyframes:', beforeResponse.data);
      return;
    }
    
    const beforeKeyframes = JSON.parse(beforeResponse.data);
    console.log(`📊 Keyframes antes: ${beforeKeyframes.length}`);
    
    // 2. Crear un período operacional
    console.log('\n2️⃣ Creando período operacional...');
    
    const postData = JSON.stringify({
      startDate: '2024-09-01',
      endDate: '2024-11-30',
      label: 'Test Sin Duplicados'
    });
    
    const createOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/operational-periods/${hotelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const createResponse = await new Promise((resolve, reject) => {
      const req = http.request(createOptions, (res) => {
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
      
      req.write(postData);
      req.end();
    });
    
    if (createResponse.status !== 201) {
      console.error('❌ Error al crear período:', createResponse.data);
      return;
    }
    
    const period = JSON.parse(createResponse.data);
    console.log(`✅ Período creado: ${period.id}`);
    
    // 3. Verificar keyframes después de crear el período
    console.log('\n3️⃣ Verificando keyframes después de crear período...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterResponse = await new Promise((resolve, reject) => {
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
    
    if (afterResponse.status !== 200) {
      console.error('❌ Error al obtener keyframes:', afterResponse.data);
      return;
    }
    
    const afterKeyframes = JSON.parse(afterResponse.data);
    console.log(`📊 Keyframes después: ${afterKeyframes.length}`);
    
    // 4. Verificar duplicados por fecha
    console.log('\n4️⃣ Verificando duplicados por fecha...');
    
    const groupedByDate = {};
    afterKeyframes.forEach(keyframe => {
      const dateKey = new Date(keyframe.date).toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(keyframe);
    });
    
    const duplicates = [];
    Object.keys(groupedByDate).forEach(dateKey => {
      const keyframesForDate = groupedByDate[dateKey];
      if (keyframesForDate.length > 1) {
        console.log(`⚠️  Duplicados encontrados para fecha ${dateKey}: ${keyframesForDate.length} keyframes`);
        duplicates.push(...keyframesForDate);
      }
    });
    
    if (duplicates.length === 0) {
      console.log('✅ No se encontraron duplicados');
    } else {
      console.log(`❌ Se encontraron ${duplicates.length} keyframes duplicados`);
    }
    
    // 5. Mostrar keyframes operacionales creados
    console.log('\n5️⃣ Keyframes operacionales creados:');
    const operationalKeyframes = afterKeyframes.filter(k => k.isOperational);
    operationalKeyframes.forEach((k, i) => {
      const dateStr = new Date(k.date).toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const typeStr = k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
      console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
    });
    
    // 6. Eliminar el período para limpiar
    console.log('\n6️⃣ Eliminando período de prueba...');
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
      console.log('⚠️  Error al eliminar período');
    }
    
    console.log('\n🎉 Prueba completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testPeriodCreationNoDuplicates(); 