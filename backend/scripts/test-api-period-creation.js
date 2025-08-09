const http = require('http');

async function testApiPeriodCreation() {
  try {
    console.log('🧪 Probando creación de período operacional via API...');
    
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional usando la API
    console.log('\n1️⃣ Creando período operacional via API...');
    
    const postData = JSON.stringify({
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      label: 'Temporada de Verano API Test'
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
    console.log(`✅ Período creado via API: ${period.id}`);
    
    // 2. Verificar que se crearon los keyframes operacionales
    console.log('\n2️⃣ Verificando keyframes operacionales...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar a que se procesen
    
    const getOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/dynamic-pricing/keyframes/${hotelId}`,
      method: 'GET'
    };
    
    const keyframesResponse = await new Promise((resolve, reject) => {
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
    
    if (keyframesResponse.status !== 200) {
      console.error('❌ Error al obtener keyframes:', keyframesResponse.data);
      return;
    }
    
    const keyframes = JSON.parse(keyframesResponse.data);
    const operationalKeyframes = keyframes.filter(k => k.isOperational);
    console.log(`✅ Keyframes operacionales encontrados: ${operationalKeyframes.length}`);
    
    operationalKeyframes.forEach((k, i) => {
      const dateStr = new Date(k.date).toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const typeStr = k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
      console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
    });
    
    // 3. Eliminar el período para limpiar
    console.log('\n3️⃣ Eliminando período de prueba...');
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

testApiPeriodCreation(); 